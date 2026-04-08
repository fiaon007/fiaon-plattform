import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Upload, Megaphone, Users, Phone, Settings as SettingsIcon, Play, Pause, FileText, Lightbulb, TrendingUp, Target, Zap, Lock, Crown, ArrowRight, Sparkles } from 'lucide-react';
import type { User, SubscriptionResponse } from "@shared/schema";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

// ARAS CI
const CI = {
  goldLight: '#E9D7C4',
  orange: '#FE9100',
  goldDark: '#A34E00',
  black: '#0a0a0a'
};

export default function Campaigns() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState(100);
  
  // Intelligente personalisierte Felder
  const [targetProduct, setTargetProduct] = useState('');
  const [callObjective, setCallObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');
  const [specialOffers, setSpecialOffers] = useState('');
  const [objectionHandling, setObjectionHandling] = useState('');
  
  // Animierte Tipps State
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Fetch subscription
  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  // 🔥 Plan normalization helper - handles all known plan variants
  const normalizePlan = (input: unknown): 'free' | 'pro' | 'ultra' | 'ultimate' | null => {
    if (!input || typeof input !== 'string') return null;
    const lower = input.toLowerCase().trim();
    
    // Free variants
    if (lower === 'free' || lower === 'starter' || lower === 'trial') return 'free';
    // Pro variants
    if (lower === 'pro' || lower === 'professional') return 'pro';
    // Ultra variants
    if (lower === 'ultra' || lower === 'aras ultra' || lower.includes('ultra')) return 'ultra';
    // Ultimate variants
    if (lower === 'ultimate' || lower === 'enterprise' || lower.includes('ultimate') || 
        lower.includes('enterprise') || lower === 'aras ultimate – enterprise mode') return 'ultimate';
    
    console.warn('[CAMPAIGNS] Unknown plan value:', input);
    return null;
  };

  // Check if user has access to campaigns (Ultra or Ultimate plan)
  const hasAccess = (): boolean => {
    // subscriptionData returns { plan: "...", ... } at top level, NOT nested
    const rawPlan = subscriptionData?.plan;
    const normalizedPlan = normalizePlan(rawPlan);
    
    if (!normalizedPlan) return false;
    return normalizedPlan === 'ultra' || normalizedPlan === 'ultimate';
  };

  const isPremiumLocked = !hasAccess();

  const handleSectionChange = (section: string) => {
    window.location.href = section === 'space' ? '/app' : `/app/${section}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast({
        title: 'Ungültiger Dateityp',
        description: 'Bitte laden Sie eine CSV oder XLSX Datei hoch.',
        variant: 'destructive'
      });
      return;
    }

    setUploadedFile(file);
    toast({
      title: 'Datei hochgeladen',
      description: `${file.name} erfolgreich geladen.`
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = {
        target: { files: [file] }
      } as any;
      handleFileUpload(fakeEvent);
    }
  };

  const handleStartCampaign = async () => {
    if (!campaignName || !targetProduct || !callObjective || !uploadedFile) {
      toast({
        title: 'Fehlende Angaben',
        description: 'Bitte füllen Sie alle Pflichtfelder (*) aus und laden Sie eine Kontaktliste hoch.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Kampagne wird gestartet',
      description: 'ARAS AI analysiert Ihre Zielgruppe und passt Gespräche individuell an...'
    });

    // TODO: Implementiere Backend-Integration
  };

  // Generiere personalisierte Vorschläge basierend auf User-Daten
  const getProductSuggestions = () => {
    if (!user) return [];
    const typedUser = user as User;
    const aiProfile = typedUser.aiProfile as any;
    if (!aiProfile) return [];
    
    const suggestions: string[] = [];
    // Normalize products - handle array or string
    const products = Array.isArray(aiProfile.products) 
      ? aiProfile.products.filter((p: unknown): p is string => typeof p === 'string' && !!p.trim())
      : (typeof aiProfile.products === 'string' && aiProfile.products.trim() 
          ? aiProfile.products.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
          : []);
    if (products.length > 0) {
      suggestions.push(...products.slice(0, 3));
    }
    
    // Normalize services - handle array or string
    const services = Array.isArray(aiProfile.services) 
      ? aiProfile.services.filter((s: unknown): s is string => typeof s === 'string' && !!s.trim())
      : (typeof aiProfile.services === 'string' && aiProfile.services.trim() 
          ? aiProfile.services.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
          : []);
    if (services.length > 0) {
      suggestions.push(...services.slice(0, 3));
    }
    return suggestions;
  };

  const getAudienceSuggestions = () => {
    if (!user) return [];
    const typedUser = user as User;
    const aiProfile = typedUser.aiProfile as any;
    
    const suggestions: string[] = [];
    if (aiProfile && aiProfile.targetAudience) {
      suggestions.push(aiProfile.targetAudience);
    }
    if (typedUser.industry) {
      suggestions.push(`${typedUser.industry}-Unternehmen`);
      suggestions.push(`Entscheider in ${typedUser.industry}`);
    }
    return suggestions;
  };

  const productSuggestions = getProductSuggestions();
  const audienceSuggestions = getAudienceSuggestions();

  // Animierte Tipps Daten
  const aiTips = [
    {
      icon: Target,
      color: CI.orange,
      title: "4% Echte Conversion-Rate",
      text: "Im Schnitt werden 4% der kontaktierten Leads zu echten Kunden – deutlich über dem Branchendurchschnitt von 1-2%."
    },
    {
      icon: Zap,
      color: CI.goldLight,
      title: "500 Quellen pro Kontakt",
      text: "ARAS AI analysiert für jeden Kontakt bis zu 500 öffentliche Datenquellen: Webseite, Handelsregister, Presse, LinkedIn, Xing und mehr."
    },
    {
      icon: TrendingUp,
      color: CI.orange,
      title: "Mehr Felder = Besserer Output",
      text: "Je mehr optionale Felder Sie ausfüllen (Zielgruppe, USP, Einwände), desto präziser wird die KI Ihre Gespräche personalisieren."
    },
    {
      icon: Lightbulb,
      color: CI.goldLight,
      title: "Ultra-Personalisierung",
      text: "Jedes Gespräch wird individuell an Person, Firma, Branche und aktuelle Ereignisse angepasst – kein generisches Skript."
    }
  ];

  // Auto-Rotation der Tipps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % aiTips.length);
    }, 5000); // 5 Sekunden pro Tipp

    return () => clearInterval(interval);
  }, [aiTips.length]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" 
          style={{ borderColor: CI.orange, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen relative overflow-hidden">
      {/* Premium Lock Modal */}
      <AnimatePresence>
        {isPremiumLocked && showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{
              background: 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(20px)'
            }}
            onClick={() => setShowUpgradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-2xl w-full rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1) 0%, rgba(10, 10, 10, 0.95) 100%)',
                border: `2px solid ${CI.orange}40`,
                boxShadow: `0 0 80px ${CI.orange}30`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated particles */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(15)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full"
                    style={{
                      background: i % 2 === 0 ? CI.orange : CI.goldLight,
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      y: [0, -30, 0],
                      opacity: [0, 1, 0],
                      scale: [0, 1.5, 0]
                    }}
                    transition={{
                      duration: 3 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                  />
                ))}
              </div>

              <div className="relative p-10">
                {/* Crown Icon */}
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    boxShadow: `0 20px 60px ${CI.orange}50`
                  }}
                  animate={{
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity
                  }}
                >
                  <Crown className="w-10 h-10 text-black" strokeWidth={2.5} />
                </motion.div>

                {/* Title */}
                <h2
                  className="text-4xl font-black text-center mb-4"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  PREMIUM FEATURE
                </h2>

                <p className="text-gray-300 text-center mb-8 text-lg">
                  Kampagnen sind exklusiv für <span className="font-bold" style={{ color: CI.orange }}>ARAS Ultra</span> und <span className="font-bold" style={{ color: CI.orange }}>Ultimate</span> verfügbar
                </p>

                {/* Features */}
                <div className="space-y-3 mb-8">
                  {[
                    { icon: Megaphone, text: 'Bis zu 10.000 gleichzeitige Anrufe' },
                    { icon: Target, text: 'KI-gesteuerte Personalisierung' },
                    { icon: TrendingUp, text: '500+ Datenquellen pro Kontakt' },
                    { icon: Sparkles, text: '4% Conversion-Rate (2x Branchenschnitt)' }
                  ].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{
                        background: 'rgba(254, 145, 0, 0.05)',
                        border: `1px solid ${CI.orange}20`
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${CI.orange}20`,
                          border: `1px solid ${CI.orange}40`
                        }}
                      >
                        <feature.icon className="w-5 h-5" style={{ color: CI.orange }} />
                      </div>
                      <span className="text-gray-300 font-medium">{feature.text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.href = '/billing'}
                    className="flex-1 py-4 px-6 rounded-xl font-bold text-black relative overflow-hidden group"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      boxShadow: `0 10px 30px ${CI.orange}40`
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'
                      }}
                      animate={{
                        x: ['-100%', '200%']
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatDelay: 0.5
                      }}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      <Crown className="w-5 h-5" />
                      Jetzt upgraden
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowUpgradeModal(false)}
                    className="px-6 py-4 rounded-xl font-bold text-gray-400 hover:text-white transition-colors"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Schließen
                  </motion.button>
                </div>

                {/* Plan Info */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    Ab <span className="font-bold" style={{ color: CI.orange }}>€249/Monat</span> • ARAS Ultra
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Premium ARAS background */}
      <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FE9100]/10 via-transparent to-[#A34E00]/10" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 22% 30%, rgba(254,145,0,0.09) 0%, transparent 55%),
              radial-gradient(circle at 78% 70%, rgba(163,78,0,0.07) 0%, transparent 55%),
              radial-gradient(circle at 50% 50%, rgba(233,215,196,0.05) 0%, transparent 65%)`
          }}
        />
      </div>

      <Sidebar
        activeSection="campaigns"
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden content-zoom">
        {/* Premium Lock Overlay */}
        {isPremiumLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center max-w-xl mx-auto px-6"
            >
              {/* Giant Lock Icon */}
              <motion.div
                className="relative inline-block mb-8"
                animate={{
                  rotate: [0, -5, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${CI.orange}40, transparent 70%)`,
                    filter: 'blur(30px)'
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity
                  }}
                />
                <div
                  className="relative w-32 h-32 rounded-3xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}20, ${CI.goldDark}20)`,
                    border: `3px solid ${CI.orange}`,
                    boxShadow: `0 20px 60px ${CI.orange}60, inset 0 1px 2px rgba(255, 255, 255, 0.1)`
                  }}
                >
                  <Lock className="w-16 h-16" style={{ color: CI.orange }} strokeWidth={2.5} />
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                className="text-5xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: `0 0 40px ${CI.orange}30`
                }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                PREMIUM FEATURE
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-xl text-gray-300 mb-8 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Kampagnen mit <span className="font-bold" style={{ color: CI.orange }}>10.000+ gleichzeitigen Anrufen</span> sind exklusiv für
                <br />
                <span className="text-2xl font-black" style={{ color: CI.orange }}>ARAS Ultra</span> und{' '}
                <span className="text-2xl font-black" style={{ color: CI.orange }}>Ultimate</span>
              </motion.p>

              {/* Unlock Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.08, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUpgradeModal(true)}
                className="px-8 py-5 rounded-2xl font-black text-lg text-black relative overflow-hidden group mx-auto"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                  boxShadow: `0 20px 60px ${CI.orange}50`
                }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
                  }}
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 0.5
                  }}
                />
                <span className="relative flex items-center justify-center gap-3">
                  <Crown className="w-6 h-6" />
                  FEATURE FREISCHALTEN
                  <ArrowRight className="w-6 h-6" />
                </span>
              </motion.button>

              {/* Additional Info */}
              <motion.div
                className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: CI.goldLight }} />
                  <span>4% Conversion-Rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: CI.goldLight }} />
                  <span>500+ Datenquellen</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: CI.goldLight }} />
                  <span>KI-Personalisierung</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
        <TopBar
          currentSection="campaigns"
          subscriptionData={subscriptionData}
          user={user as User}
          isVisible={true}
        />

        <div className="flex-1 overflow-y-auto px-8 py-10">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <motion.h1
                className="text-5xl font-black mb-4"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                KAMPAGNEN
              </motion.h1>

              <p className="text-gray-400 text-sm">
                Starten Sie professionelle Massencall-Kampagnen mit bis zu <span style={{ color: CI.orange, fontWeight: 600 }}>10.000</span> gleichzeitigen Anrufen
              </p>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* LEFT: Campaign Setup */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="relative rounded-2xl p-8"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {/* Brand Tag */}
                <div className="mb-8 flex items-center justify-center">
                  <img src={arasLogo} alt="ARAS" className="w-8 h-8 object-contain mr-2" />
                  <div
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange})`,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                    className="text-lg font-bold"
                  >
                    KAMPAGNEN-SETUP
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Campaign Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kampagnenname*</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="z.B. Q1 2025 Akquise"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Produkt/Dienstleistung - MIT VORSCHLÄGEN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Welches Produkt / Dienstleistung verkaufen?*
                    </label>
                    <input
                      type="text"
                      value={targetProduct}
                      onChange={(e) => setTargetProduct(e.target.value)}
                      placeholder={productSuggestions[0] || `z.B. ${(user as User)?.company ? (user as User).company + ' Lösung' : 'Premium Software'}`}
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    {/* Schnellauswahl aus Profil */}
                    {productSuggestions.length > 0 && !targetProduct && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {productSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setTargetProduct(suggestion)}
                            className="px-3 py-1 rounded-full text-xs transition-all"
                            style={{
                              background: 'rgba(254,145,0,0.1)',
                              border: '1px solid rgba(254,145,0,0.3)',
                              color: CI.goldLight
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Anrufziel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Was ist das Ziel des Anrufs?*
                    </label>
                    <select
                      value={callObjective}
                      onChange={(e) => setCallObjective(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      <option value="">Ziel auswählen...</option>
                      <option value="termin">Termin vereinbaren</option>
                      <option value="demo">Produktdemo anbieten</option>
                      <option value="angebot">Angebot unterbreiten</option>
                      <option value="qualifikation">Lead qualifizieren</option>
                      <option value="reaktivierung">Kunden reaktivieren</option>
                      <option value="feedback">Feedback einholen</option>
                      <option value="upsell">Upselling / Cross-Selling</option>
                      <option value="event">Event-Einladung</option>
                    </select>
                  </div>

                  {/* Zielgruppe */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      An wen richtet sich die Kampagne?
                    </label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder={audienceSuggestions[0] || 'z.B. Geschäftsführer mittelständischer Unternehmen'}
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    {audienceSuggestions.length > 0 && !targetAudience && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {audienceSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setTargetAudience(suggestion)}
                            className="px-3 py-1 rounded-full text-xs transition-all"
                            style={{
                              background: 'rgba(254,145,0,0.1)',
                              border: '1px solid rgba(254,145,0,0.3)',
                              color: CI.goldLight
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kernbotschaft */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Kernbotschaft / USP
                    </label>
                    <textarea
                      value={keyMessage}
                      onChange={(e) => setKeyMessage(e.target.value)}
                      placeholder="Was macht Ihr Angebot einzigartig? Was ist der Hauptnutzen?"
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all resize-none text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Erwünschtes Ergebnis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Gewünschtes Ergebnis
                    </label>
                    <input
                      type="text"
                      value={desiredOutcome}
                      onChange={(e) => setDesiredOutcome(e.target.value)}
                      placeholder="z.B. Termin in Kalender eintragen, Ja zur Demo"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Follow-Up Aktion */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Follow-Up Aktion
                    </label>
                    <input
                      type="text"
                      value={followUpAction}
                      onChange={(e) => setFollowUpAction(e.target.value)}
                      placeholder="z.B. Email mit Unterlagen senden, Rückruf vereinbaren"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Spezielle Angebote */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Spezielle Angebote / Aktionen
                    </label>
                    <input
                      type="text"
                      value={specialOffers}
                      onChange={(e) => setSpecialOffers(e.target.value)}
                      placeholder="z.B. 20% Rabatt für Erstbesteller, kostenloser Test"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Einwandbehandlung */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Häufige Einwände & Antworten
                    </label>
                    <textarea
                      value={objectionHandling}
                      onChange={(e) => setObjectionHandling(e.target.value)}
                      placeholder='z.B. "Zu teuer" → Wir bieten flexible Zahlungsmodelle'
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all resize-none text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kontaktliste (CSV/XLSX)*</label>
                    <div
                      className="rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer"
                      style={{
                        borderColor: uploadedFile ? CI.orange + '60' : 'rgba(255,255,255,0.15)',
                        background: uploadedFile ? 'rgba(254,145,0,0.05)' : 'rgba(0,0,0,0.25)'
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('fileInput')?.click()}
                    >
                      <input
                        id="fileInput"
                        type="file"
                        accept=".csv,.xlsx"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Upload className="w-10 h-10 mx-auto mb-2" style={{ color: uploadedFile ? CI.orange : '#6b7280' }} />
                      {uploadedFile ? (
                        <>
                          <p className="text-white font-medium text-sm">{uploadedFile.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-300 text-sm">Datei hier ablegen oder klicken</p>
                          <p className="text-xs text-gray-500 mt-1">CSV oder XLSX (Name, Firma, Telefon)</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Max Concurrent Calls */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Gleichzeitige Anrufe: <span style={{ color: CI.orange, fontWeight: 700 }}>{maxConcurrentCalls}</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="10000"
                      step="10"
                      value={maxConcurrentCalls}
                      onChange={(e) => setMaxConcurrentCalls(parseInt(e.target.value))}
                      className="w-full"
                      style={{
                        accentColor: CI.orange
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>10</span>
                      <span>5.000</span>
                      <span>10.000</span>
                    </div>
                  </div>

                  {/* Personalisierungs-Hinweis */}
                  <div className="rounded-xl p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(233, 215, 196, 0.05))',
                      border: '1px solid rgba(254, 145, 0, 0.2)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'rgba(254, 145, 0, 0.15)',
                          border: '1px solid rgba(254, 145, 0, 0.3)'
                        }}
                      >
                        <Users className="w-4 h-4" style={{ color: CI.orange }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white mb-1">KI-Personalisierung aktiv</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          ARAS AI nutzt Ihre Profildaten ({(user as User)?.company || 'Unternehmen'}, {(user as User)?.industry || 'Branche'}) 
                          und analysiert für jeden Kontakt bis zu 500 Quellen für maximale Relevanz.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleStartCampaign}
                    disabled={!campaignName || !targetProduct || !callObjective || !uploadedFile}
                    className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: !campaignName || !targetProduct || !callObjective || !uploadedFile
                        ? 'rgba(100, 100, 100, 0.3)'
                        : `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      border: `1px solid ${!campaignName || !targetProduct || !callObjective || !uploadedFile ? 'rgba(255, 255, 255, 0.1)' : CI.orange}`,
                      color: '#fff',
                      boxShadow: !campaignName || !targetProduct || !callObjective || !uploadedFile ? 'none' : `0 8px 30px ${CI.orange}40`,
                      fontFamily: 'Orbitron, sans-serif'
                    }}
                  >
                    <Play className="w-5 h-5" />
                    <span>KAMPAGNE STARTEN</span>
                  </button>
                </div>
              </motion.div>

              {/* RIGHT: Info & Stats */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* Info Card */}
                <div className="rounded-2xl p-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1), rgba(233, 215, 196, 0.05))',
                    border: '1px solid rgba(254, 145, 0, 0.2)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Megaphone className="w-6 h-6" style={{ color: CI.orange }} />
                    <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Massencalls mit ARAS AI
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                    <p>
                      <span style={{ color: CI.orange, fontWeight: 600 }}>ARAS AI</span> analysiert für jeden Kontakt bis zu{' '}
                      <span style={{ color: CI.goldLight, fontWeight: 600 }}>500 öffentliche Quellen</span> – 
                      Webseiten, Handelsregister, Presse, Social Profiles und mehr.
                    </p>
                    <p>
                      Das Gespräch wird präzise an Person, Firma und Kontext angepasst – 
                      für <span style={{ color: CI.orange }}>maximale Erfolgsquote</span>.
                    </p>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Phone, label: 'Gleichzeitig', value: '10.000', color: CI.orange },
                    { icon: Users, label: 'Personalisiert', value: '100%', color: CI.goldLight },
                  ].map((stat, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + (idx * 0.1) }}
                      className="rounded-xl p-5 text-center"
                      style={{
                        background: 'rgba(0,0,0,0.55)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      <stat.icon className="w-8 h-8 mx-auto mb-2" style={{ color: stat.color }} />
                      <div className="text-2xl font-black" style={{ color: stat.color, fontFamily: 'Orbitron, sans-serif' }}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Requirements */}
                <div className="rounded-xl p-6"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5" style={{ color: CI.orange }} />
                    <h4 className="text-sm font-bold text-white">Anforderungen an die Datei</h4>
                  </div>
                  <ul className="space-y-2 text-xs text-gray-400">
                    <li className="flex items-start gap-2">
                      <span style={{ color: CI.orange }}>•</span>
                      <span>Format: CSV oder XLSX</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span style={{ color: CI.orange }}>•</span>
                      <span>Pflicht-Spalten: Name, Firma, Telefon</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span style={{ color: CI.orange }}>•</span>
                      <span>Telefon-Format: +49... (international)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span style={{ color: CI.orange }}>•</span>
                      <span>Optional: Email, Position, Website</span>
                    </li>
                  </ul>
                </div>

                {/* NEUE: Animierte ARAS AI Tipps */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.12), rgba(233, 215, 196, 0.08))',
                    border: '2px solid rgba(254, 145, 0, 0.25)',
                  }}
                >
                  {/* Header */}
                  <div className="px-5 py-3 flex items-center justify-between"
                    style={{
                      background: 'rgba(254, 145, 0, 0.15)',
                      borderBottom: '1px solid rgba(254, 145, 0, 0.2)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: CI.orange,
                          boxShadow: `0 0 15px ${CI.orange}60`
                        }}
                      >
                        <Lightbulb className="w-4 h-4 text-black" />
                      </div>
                      <span className="text-xs font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        WIE ARAS AI ARBEITET
                      </span>
                    </div>
                    {/* Tip Indicators */}
                    <div className="flex gap-1.5">
                      {aiTips.map((_, idx) => (
                        <motion.div
                          key={idx}
                          className="w-1.5 h-1.5 rounded-full cursor-pointer"
                          onClick={() => setCurrentTipIndex(idx)}
                          animate={{
                            backgroundColor: idx === currentTipIndex ? CI.orange : 'rgba(255,255,255,0.25)',
                            scale: idx === currentTipIndex ? 1.3 : 1
                          }}
                          transition={{ duration: 0.3 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Animated Tips Content */}
                  <div className="relative h-32 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTipIndex}
                        initial={{ opacity: 0, x: 50, rotateY: -15 }}
                        animate={{ opacity: 1, x: 0, rotateY: 0 }}
                        exit={{ opacity: 0, x: -50, rotateY: 15 }}
                        transition={{ 
                          duration: 0.6,
                          ease: [0.25, 0.46, 0.45, 0.94]
                        }}
                        className="absolute inset-0 p-5"
                      >
                        <div className="flex items-start gap-4 h-full">
                          {/* Icon */}
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${aiTips[currentTipIndex].color}25, ${aiTips[currentTipIndex].color}10)`,
                              border: `1.5px solid ${aiTips[currentTipIndex].color}50`,
                            }}
                          >
                            {React.createElement(aiTips[currentTipIndex].icon, {
                              className: "w-6 h-6",
                              style: { color: aiTips[currentTipIndex].color }
                            })}
                          </motion.div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <motion.h5
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                              className="text-sm font-bold mb-2"
                              style={{ 
                                color: aiTips[currentTipIndex].color,
                                fontFamily: 'Orbitron, sans-serif'
                              }}
                            >
                              {aiTips[currentTipIndex].title}
                            </motion.h5>
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.4 }}
                              className="text-xs text-gray-300 leading-relaxed"
                            >
                              {aiTips[currentTipIndex].text}
                            </motion.p>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1 bg-black/30 relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0"
                      style={{
                        background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldLight})`,
                        boxShadow: `0 0 10px ${CI.orange}80`
                      }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{
                        duration: 5,
                        ease: 'linear',
                        repeat: Infinity,
                        repeatDelay: 0
                      }}
                      key={currentTipIndex}
                    />
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Font */}
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    </div>
  );
}
