import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { User, SubscriptionResponse } from '@shared/schema';

// ARAS CI Colors
const CI = {
  orange: '#FE9100',
  goldLight: '#E9D7C4',
  goldDark: '#A34E00',
};

// Tabs
type TabType = 'account' | 'notifications' | 'security' | 'privacy';

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Form States
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    campaignAlerts: true,
    weeklyReports: false,
    aiSuggestions: true,
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    dataCollection: true,
    analytics: true,
    thirdPartySharing: false,
  });

  // Fetch subscription data
  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['/api/user/subscription'],
    enabled: !!user && !authLoading,
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery<any>({
    queryKey: ['/api/user/usage'],
    enabled: !!user && !authLoading,
  });

  // Initialize profile form
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: (user as any).username || '',
        email: (user as any).email || '',
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
      });
    }
  }, [user]);

  // Update Profile Mutation
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
        throw new Error(error.message || 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Profil aktualisiert',
        description: 'Deine Änderungen wurden gespeichert!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Change Password Mutation
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
        throw new Error(error.message || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Passwort geändert',
        description: 'Dein Passwort wurde erfolgreich aktualisiert!',
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete Account Mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete account');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Account gelöscht',
        description: 'Dein Account wurde erfolgreich gelöscht.',
      });
      window.location.href = '/';
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save Notifications
  const saveNotificationsMutation = useMutation({
    mutationFn: async (data: typeof notificationSettings) => {
      const res = await fetch('/api/user/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Benachrichtigungen gespeichert',
        description: 'Deine Einstellungen wurden aktualisiert!',
      });
    },
  });

  // Save Privacy Settings
  const savePrivacyMutation = useMutation({
    mutationFn: async (data: typeof privacySettings) => {
      const res = await fetch('/api/user/privacy-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Datenschutz gespeichert',
        description: 'Deine Einstellungen wurden aktualisiert!',
      });
    },
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0a0a0a, #151515)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 rounded-full"
          style={{
            borderColor: `${CI.orange}40`,
            borderTopColor: CI.orange,
          }}
        />
      </div>
    );
  }

  const tabs = [
    { id: 'account' as TabType, label: 'Konto' },
    { id: 'notifications' as TabType, label: 'Benachrichtigungen' },
    { id: 'security' as TabType, label: 'Sicherheit' },
    { id: 'privacy' as TabType, label: 'Datenschutz' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #0a0a0a, #151515)' }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-3" style={{
            background: `linear-gradient(135deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Einstellungen
          </h1>
          <p className="text-lg" style={{ color: CI.goldLight }}>
            Verwalte deinen Account und personalisiere deine Erfahrung
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-8 overflow-x-auto pb-2"
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all"
              style={{
                background: activeTab === tab.id
                  ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                  : `linear-gradient(135deg, ${CI.orange}15, ${CI.goldDark}10)`,
                color: activeTab === tab.id ? '#000' : CI.goldLight,
                border: `2px solid transparent`,
                backgroundImage: activeTab === tab.id
                  ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                  : `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                backgroundOrigin: 'border-box',
                backgroundClip: activeTab === tab.id ? 'padding-box' : 'padding-box, border-box',
                boxShadow: activeTab === tab.id ? `0 0 20px ${CI.orange}60` : 'none',
              }}
            >
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* Subscription Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}08, ${CI.goldDark}05)`,
                    border: `2px solid transparent`,
                    backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  <h2 className="text-2xl font-bold mb-4" style={{ color: CI.goldLight }}>
                    Dein Plan
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-sm mb-1" style={{ color: CI.goldLight }}>Status</p>
                      <p className="text-xl font-bold" style={{ color: CI.orange }}>
                        {subscription?.status === 'active' ? 'Aktiv' : 'Trial'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-sm mb-1" style={{ color: CI.goldLight }}>Plan</p>
                      <p className="text-xl font-bold" style={{ color: CI.orange }}>
                        {subscription?.plan || 'Free'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-sm mb-1" style={{ color: CI.goldLight }}>AI Nachrichten</p>
                      <p className="text-xl font-bold" style={{ color: CI.orange }}>
                        {subscription?.aiMessagesUsed || 0} / {subscription?.aiMessagesLimit || '∞'}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CI.orange}60` }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.location.href = '/app/billing'}
                    className="mt-6 w-full py-3 rounded-xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      color: '#000',
                    }}
                  >
                    Plan upgraden
                  </motion.button>
                </motion.div>

                {/* Profile Form */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}08, ${CI.goldDark}05)`,
                    border: `2px solid transparent`,
                    backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  <h2 className="text-2xl font-bold mb-6" style={{ color: CI.goldLight }}>
                    Profil bearbeiten
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `2px solid ${CI.orange}20`,
                        }}
                        onFocus={(e) => e.target.style.borderColor = CI.orange}
                        onBlur={(e) => e.target.style.borderColor = `${CI.orange}20`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `2px solid ${CI.orange}20`,
                        }}
                        onFocus={(e) => e.target.style.borderColor = CI.orange}
                        onBlur={(e) => e.target.style.borderColor = `${CI.orange}20`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                        Vorname
                      </label>
                      <input
                        type="text"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `2px solid ${CI.orange}20`,
                        }}
                        onFocus={(e) => e.target.style.borderColor = CI.orange}
                        onBlur={(e) => e.target.style.borderColor = `${CI.orange}20`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                        Nachname
                      </label>
                      <input
                        type="text"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `2px solid ${CI.orange}20`,
                        }}
                        onFocus={(e) => e.target.style.borderColor = CI.orange}
                        onBlur={(e) => e.target.style.borderColor = `${CI.orange}20`}
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CI.orange}60` }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateProfileMutation.mutate(profileForm)}
                    disabled={updateProfileMutation.isPending}
                    className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      color: '#000',
                    }}
                  >
                    {updateProfileMutation.isPending ? 'Speichere...' : 'Änderungen speichern'}
                  </motion.button>
                </motion.div>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}08, ${CI.goldDark}05)`,
                  border: `2px solid transparent`,
                  backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                }}
              >
                <h2 className="text-2xl font-bold mb-6" style={{ color: CI.goldLight }}>
                  Benachrichtigungen
                </h2>

                <div className="space-y-6">
                  {[
                    { key: 'emailNotifications', label: 'Email-Benachrichtigungen', desc: 'Erhalte Updates per Email' },
                    { key: 'campaignAlerts', label: 'Kampagnen-Alerts', desc: 'Werde über Kampagnen-Events benachrichtigt' },
                    { key: 'weeklyReports', label: 'Wöchentliche Reports', desc: 'Zusammenfassung deiner Aktivitäten' },
                    { key: 'aiSuggestions', label: 'AI-Vorschläge', desc: 'Erhalte intelligente Empfehlungen' },
                  ].map((setting, idx) => (
                    <motion.div
                      key={setting.key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: CI.goldLight }}>{setting.label}</p>
                        <p className="text-sm" style={{ color: `${CI.goldLight}80` }}>{setting.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotificationSettings({
                          ...notificationSettings,
                          [setting.key]: !notificationSettings[setting.key as keyof typeof notificationSettings]
                        })}
                        className="relative w-14 h-8 rounded-full transition-all"
                        style={{
                          background: notificationSettings[setting.key as keyof typeof notificationSettings]
                            ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                            : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <motion.div
                          animate={{
                            x: notificationSettings[setting.key as keyof typeof notificationSettings] ? 24 : 2
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-6 h-6 rounded-full bg-white"
                        />
                      </button>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CI.orange}60` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => saveNotificationsMutation.mutate(notificationSettings)}
                  disabled={saveNotificationsMutation.isPending}
                  className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                  }}
                >
                  {saveNotificationsMutation.isPending ? 'Speichere...' : 'Einstellungen speichern'}
                </motion.button>
              </motion.div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Password Change */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}08, ${CI.goldDark}05)`,
                    border: `2px solid transparent`,
                    backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  <h2 className="text-2xl font-bold mb-4" style={{ color: CI.goldLight }}>
                    Passwort ändern
                  </h2>
                  <p className="mb-6" style={{ color: `${CI.goldLight}80` }}>
                    Schütze deinen Account mit einem starken Passwort
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CI.orange}60` }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPasswordDialog(true)}
                    className="px-6 py-3 rounded-xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      color: '#000',
                    }}
                  >
                    Passwort ändern
                  </motion.button>
                </motion.div>

                {/* Delete Account */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,0,0,0.08), rgba(139,0,0,0.05))`,
                    border: `2px solid transparent`,
                    backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, rgba(255,0,0,0.4), rgba(139,0,0,0.2))`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  <h2 className="text-2xl font-bold mb-4 text-red-400">
                    Account löschen
                  </h2>
                  <p className="mb-6" style={{ color: `${CI.goldLight}80` }}>
                    ⚠️ Diese Aktion kann nicht rückgängig gemacht werden! Alle deine Daten werden permanent gelöscht.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteDialog(true)}
                    className="px-6 py-3 rounded-xl font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #ff0000, #8b0000)',
                      color: '#fff',
                    }}
                  >
                    Account endgültig löschen
                  </motion.button>
                </motion.div>
              </div>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}08, ${CI.goldDark}05)`,
                  border: `2px solid transparent`,
                  backgroundImage: `linear-gradient(black, black), linear-gradient(135deg, ${CI.orange}40, ${CI.goldLight}20)`,
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                }}
              >
                <h2 className="text-2xl font-bold mb-6" style={{ color: CI.goldLight }}>
                  Datenschutz
                </h2>

                <div className="space-y-6">
                  {[
                    { key: 'dataCollection', label: 'Datensammlung', desc: 'Erlaube ARAS AI, Nutzungsdaten zu sammeln' },
                    { key: 'analytics', label: 'Analytics', desc: 'Hilf uns, ARAS AI zu verbessern' },
                    { key: 'thirdPartySharing', label: 'Drittanbieter', desc: 'Daten mit Partnern teilen' },
                  ].map((setting, idx) => (
                    <motion.div
                      key={setting.key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: CI.goldLight }}>{setting.label}</p>
                        <p className="text-sm" style={{ color: `${CI.goldLight}80` }}>{setting.desc}</p>
                      </div>
                      <button
                        onClick={() => setPrivacySettings({
                          ...privacySettings,
                          [setting.key]: !privacySettings[setting.key as keyof typeof privacySettings]
                        })}
                        className="relative w-14 h-8 rounded-full transition-all"
                        style={{
                          background: privacySettings[setting.key as keyof typeof privacySettings]
                            ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                            : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <motion.div
                          animate={{
                            x: privacySettings[setting.key as keyof typeof privacySettings] ? 24 : 2
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-6 h-6 rounded-full bg-white"
                        />
                      </button>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm mb-2" style={{ color: CI.goldLight }}>
                    🔒 Deine Daten sind sicher
                  </p>
                  <p className="text-sm" style={{ color: `${CI.goldLight}80` }}>
                    Wir verwenden End-to-End-Verschlüsselung und teilen deine Daten niemals ohne deine Zustimmung.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CI.orange}60` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => savePrivacyMutation.mutate(privacySettings)}
                  disabled={savePrivacyMutation.isPending}
                  className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                  }}
                >
                  {savePrivacyMutation.isPending ? 'Speichere...' : 'Einstellungen speichern'}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Password Change Dialog */}
      <AnimatePresence>
        {showPasswordDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowPasswordDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-8 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98))`,
                border: `2px solid transparent`,
                backgroundImage: `linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98)), linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                boxShadow: `0 0 40px ${CI.orange}20`,
              }}
            >
              <h2 className="text-2xl font-bold mb-6" style={{ color: CI.goldLight }}>
                Passwort ändern
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                    Aktuelles Passwort
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-white focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px solid ${CI.orange}20`,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                    Neues Passwort
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-white focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px solid ${CI.orange}20`,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: CI.goldLight }}>
                    Passwort bestätigen
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-white focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px solid ${CI.orange}20`,
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => changePasswordMutation.mutate(passwordForm)}
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                  }}
                >
                  {changePasswordMutation.isPending ? 'Ändere...' : 'Passwort ändern'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPasswordDialog(false)}
                  className="flex-1 py-3 rounded-xl font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: CI.goldLight,
                  }}
                >
                  Abbrechen
                </motion.button>
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
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowDeleteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-8 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, rgba(20,10,10,0.98), rgba(30,10,10,0.98))`,
                border: `2px solid transparent`,
                backgroundImage: `linear-gradient(135deg, rgba(20,10,10,0.98), rgba(30,10,10,0.98)), linear-gradient(135deg, #ff0000, #8b0000)`,
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                boxShadow: '0 0 40px rgba(255,0,0,0.2)',
              }}
            >
              <h2 className="text-2xl font-bold mb-4 text-red-400">
                ⚠️ Account löschen?
              </h2>
              <p className="mb-6 text-gray-300">
                Diese Aktion ist <strong>permanent</strong> und kann nicht rückgängig gemacht werden!
                <br /><br />
                Alle deine Daten, Kontakte, Kampagnen und Einstellungen werden unwiederbringlich gelöscht.
              </p>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #ff0000, #8b0000)',
                    color: '#fff',
                  }}
                >
                  {deleteAccountMutation.isPending ? 'Lösche...' : 'Ja, Account löschen'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 py-3 rounded-xl font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                >
                  Abbrechen
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
