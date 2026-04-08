import { useState, useEffect, useLayoutEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ErrorBoundary } from "@/components/error-boundary";
import { ArasCore20Overlay } from "@/components/overlays/aras-core20-overlay";
import { SpaceUpgradeOfferOverlay } from "@/components/overlays/space-upgrade-offer-overlay";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, Target, Users, Swords, Sparkles, Key, TrendingUp, Phone, Quote, Shield, ArrowRight, ChevronRight } from "lucide-react";
import type { User, SubscriptionResponse } from "@shared/schema";

export default function Space() {
  // FIX: Route-entry scroll reset - ensures page starts at top, no bounce-back
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showTopBar, setShowTopBar] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  const [typedResearchIndex, setTypedResearchIndex] = useState(0);
  
  // 🔥 CINEMATIC INTRO STATE - HIGH-END CI DESIGN
  const [showCinematicIntro, setShowCinematicIntro] = useState(false);
  const [introPhase, setIntroPhase] = useState<'boot' | 'scan' | 'results'>('boot');
  const [showButtons, setShowButtons] = useState(false);
  
  const { user, isLoading: authLoading } = useAuth();
  
  // 🔥 FORCE REFETCH user data on mount to get fresh aiProfile after enrichment
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);
  
  // Get AI Profile from user
  const aiProfile = (user as any)?.aiProfile || {};
  const companyName = (user as any)?.company || "dein Unternehmen";
  const companyDescription = aiProfile?.companyDescription || "";
  
  const fullText = companyDescription || "Womit kann ich dir heute helfen?";
  
  // Fetch user's subscription data
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });
  
  const subscriptionData: SubscriptionResponse | undefined = userSubscription || undefined;
  
  // 🔥 LOADING STATE - Prevent black screen
  const isPageLoading = authLoading || (!!user && subscriptionLoading);

  const handleSectionChange = (section: string) => {
    if (section !== "space") {
      window.location.href = `/${section}`;
    }
  };

  // 🔥 CHECK IF THIS IS FIRST VISIT (SHOW CINEMATIC INTRO)
  useEffect(() => {
    if (!user) return;
    
    const userId = (user as any)?.id;
    const firstName = (user as any)?.firstName;
    const company = (user as any)?.company;
    
    if (!userId) return;
    
    const hasSeenIntro = localStorage.getItem(`aras_intro_seen_${userId}`);
    
    // CRITICAL: Only show cinematic intro if we have required data
    // Relaxed validation - just check if description exists and has some content
    const hasValidData = firstName && company && aiProfile?.companyDescription && aiProfile.companyDescription.length > 20;
    
    console.log('[CINEMATIC-INTRO-DEBUG] Check:', {
      userId,
      firstName,
      company,
      hasProfile: !!aiProfile,
      descLength: aiProfile?.companyDescription?.length || 0,
      hasSeenIntro,
      hasValidData
    });
    
    if (!hasSeenIntro && hasValidData) {
      console.log('[CINEMATIC-INTRO] ✅ STARTING INTRO for:', firstName, company);
      setShowCinematicIntro(true);
      setShowWelcome(false); // Hide normal welcome
      
      // Mark as seen
      localStorage.setItem(`aras_intro_seen_${userId}`, 'true');
    } else if (!hasSeenIntro && !hasValidData) {
      console.log('[CINEMATIC-INTRO] ⚠️ Skipping - waiting for data...');
      // Don't mark as seen yet - wait for data to load
      // User will see intro on next render when data arrives
    }
  }, [user, aiProfile]);

  // 🔥 CINEMATIC INTRO SEQUENCE
  useEffect(() => {
    if (!showCinematicIntro) return;
    
    // Safety check: If we somehow get here without data, abort
    if (!user || !aiProfile?.companyDescription) {
      console.error('[CINEMATIC-INTRO] Aborting - missing required data');
      setShowCinematicIntro(false);
      return;
    }

    // ⚡ FASTER HIGH-END TIMING
    // Phase 1: Boot (0-0.6s)
    const bootTimer = setTimeout(() => {
      setIntroPhase('scan');
    }, 600);

    // Phase 2: Scan (0.6-1.3s)
    const scanTimer = setTimeout(() => {
      setIntroPhase('results');
    }, 1300);

    // Phase 3: Show buttons (1.8s)
    const buttonTimer = setTimeout(() => {
      setShowButtons(true);
    }, 1800);

    return () => {
      clearTimeout(bootTimer);
      clearTimeout(scanTimer);
      clearTimeout(buttonTimer);
    };
  }, [showCinematicIntro, user, aiProfile]);

  // Typewriter effect for subtitle
  useEffect(() => {
    if (!showWelcome) return;
    
    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [showWelcome]);

  // Auto-hide welcome banner after 15 seconds (longer for research display)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 25000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-hide topbar after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTopBar(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Show topbar on mouse hover at top
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 50) {
        setShowTopBar(true);
      } else if (e.clientY > 100) {
        setShowTopBar(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 🔥 SHOW LOADING SCREEN - Prevents black screen
  if (isPageLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div
            className="w-16 h-16 border-4 border-[#FE9100] border-t-transparent rounded-full mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-gray-400 text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            ARAS AI lädt...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 🔥 ARAS CORE 2.0 PRO — SYSTEM UPDATE OVERLAY */}
      <ArasCore20Overlay userId={String((user as any)?.id || '')} />

      {/* 🔥 DELAYED UPGRADE OFFER OVERLAY — appears after 30-50s */}
      <SpaceUpgradeOfferOverlay
        isSpaceVisible={!isPageLoading}
        hasBlockingOverlay={showCinematicIntro}
      />

      {/* 🔥 CINEMATIC INTRO OVERLAY */}
      <AnimatePresence>
        {showCinematicIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* NO PARTICLES - Clean transparent background to see SPACE */}

            {/* HIGH END Structured Container - Smaller */}
            {/* 🎬 HIGH-END CI CONTAINER */}
            <div className="relative z-10 max-w-5xl mx-auto w-full">
              
              {/* ═══════════════════════════════════════════ */}
              {/* PHASE 1: BOOT - Fast & Clean (0-0.6s) */}
              {/* ═══════════════════════════════════════════ */}
              {introPhase === 'boot' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="text-center space-y-4"
                >
                  <motion.h1
                    className="text-7xl font-black"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(135deg, #FE9100 0%, #ff6b00 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    ARAS AI
                  </motion.h1>
                  <motion.div
                    className="flex items-center justify-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-1.5 h-1.5 bg-[#FE9100] rounded-full animate-pulse" />
                    <p className="text-gray-400 text-sm font-light tracking-wide">INITIALIZING</p>
                  </motion.div>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* PHASE 2: SCAN - Progress Bar (0.6-1.3s) */}
              {/* ═══════════════════════════════════════════ */}
              {introPhase === 'scan' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center space-y-5"
                >
                  <h2 className="text-2xl font-bold text-white tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    UNTERNEHMENSANALYSE
                  </h2>
                  <div className="w-full max-w-sm mx-auto">
                    <div className="h-0.5 bg-black/50 rounded-full overflow-hidden border border-[#FE9100]/20">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#FE9100] to-[#ff6b00]"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.7, ease: "easeInOut" }}
                        style={{
                          boxShadow: '0 0 10px rgba(254, 145, 0, 0.6)'
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest">Generating AI Profile...</p>
                </motion.div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* PHASE 3: RESULTS - WOW Experience! */}
              {/* ═══════════════════════════════════════════ */}
              {introPhase === 'results' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="space-y-8"
                >
                  {/* 🎯 WELCOME HEADER - CI Style */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center space-y-3"
                  >
                    <h2 
                      className="text-4xl font-black tracking-tight"
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        background: 'linear-gradient(135deg, #FE9100 0%, #ff6b00 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      WILLKOMMEN, {(user as any)?.firstName?.toUpperCase()}
                    </h2>
                    <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-[#FE9100] to-transparent" />
                    <p className="text-gray-300 text-sm tracking-wide">DEIN PERSÖNLICHES AI PROFIL IST BEREIT</p>
                  </motion.div>

                  {/* 📊 COMPANY STATS - 3 Cards */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    <div className="backdrop-blur-sm bg-black/20 border border-[#FE9100]/20 rounded-xl p-4 hover:border-[#FE9100]/40 transition-colors">
                      <div className="text-[#FE9100] text-[10px] font-bold mb-1.5 tracking-widest">UNTERNEHMEN</div>
                      <div className="text-white text-base font-bold truncate">{(user as any)?.company || 'N/A'}</div>
                    </div>
                    <div className="backdrop-blur-sm bg-black/20 border border-[#FE9100]/20 rounded-xl p-4 hover:border-[#FE9100]/40 transition-colors">
                      <div className="text-[#FE9100] text-[10px] font-bold mb-1.5 tracking-widest">BRANCHE</div>
                      <div className="text-white text-base font-bold truncate">{(user as any)?.industry || 'Tech'}</div>
                    </div>
                    <div className="backdrop-blur-sm bg-black/20 border border-[#FE9100]/20 rounded-xl p-4 hover:border-[#FE9100]/40 transition-colors">
                      <div className="text-[#FE9100] text-[10px] font-bold mb-1.5 tracking-widest">POSITION</div>
                      <div className="text-white text-base font-bold truncate">{(user as any)?.role || 'CEO'}</div>
                    </div>
                  </motion.div>

                  {/* 📝 COMPANY DESCRIPTION - Clean */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="backdrop-blur-sm bg-black/10 border border-[#FE9100]/20 rounded-2xl p-6"
                  >
                    <p className="text-gray-200 text-sm leading-relaxed text-center">
                      {aiProfile?.companyDescription?.slice(0, 300) || 'Ihr Unternehmen wurde erfolgreich analysiert.'}...
                    </p>
                  </motion.div>

                  {/* 🎬 TWO HIGH-END BUTTONS */}
                  <AnimatePresence>
                    {showButtons && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.8 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
                      >
                        {/* PRIMARY: ARAS AI starten */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowCinematicIntro(false)}
                          className="relative px-12 py-4 rounded-full font-bold text-base text-white group overflow-hidden"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            background: 'transparent',
                          }}
                        >
                          <motion.div
                            className="absolute inset-0 rounded-full p-[2px]"
                            style={{
                              background: 'linear-gradient(90deg, #FE9100 0%, #ff6b00 50%, #FE9100 100%)',
                              backgroundSize: '200% auto',
                            }}
                            animate={{
                              backgroundPosition: ['0% 50%', '200% 50%'],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                          >
                            <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm" />
                          </motion.div>
                          <motion.div
                            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{
                              boxShadow: '0 0 40px rgba(254,145,0,0.6), inset 0 0 40px rgba(254,145,0,0.2)'
                            }}
                          />
                          <span className="relative z-10">ARAS AI starten</span>
                        </motion.button>

                        {/* SECONDARY: Vollständige Analyse */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => window.location.href = '/knowledge'}
                          className="relative px-10 py-3.5 rounded-full font-medium text-sm text-white/90 group overflow-hidden border border-[#FE9100]/30 hover:border-[#FE9100]/60 transition-all backdrop-blur-sm bg-black/20"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          <span className="relative z-10">Vollständige Analyse anzeigen</span>
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar 
        activeSection="space" 
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col relative content-zoom">
        <TopBar 
          currentSection="space" 
          subscriptionData={subscriptionData}
          user={user as import("@shared/schema").User}
          isVisible={showTopBar}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 🔥 ARAS CI — INTELLIGENCE BRIEFING BANNER */}
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden overflow-y-auto max-h-[85vh] border-b border-[#e9d7c4]/8"
                style={{ isolation: 'isolate', borderBottom: '1px solid rgba(233,215,196,0.06)' }}
              >
                {/* Premium Aura Backgrounds */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'radial-gradient(1200px 500px at 18% 10%, rgba(254,145,0,0.08), transparent 62%), radial-gradient(800px 400px at 86% 18%, rgba(233,215,196,0.05), transparent 64%), radial-gradient(600px 300px at 50% 90%, rgba(163,78,0,0.06), transparent 70%)'
                }} />

                <div className="relative px-4 sm:px-6 py-5 z-[1]">
                  <div className="max-w-6xl mx-auto space-y-4 overflow-hidden">
                    
                    {/* ═══ HEADER ═══ */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <motion.div 
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 }}
                          className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#e9d7c4]/16 backdrop-blur-sm"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'linear-gradient(180deg, #FE9100, #a34e00)', boxShadow: '0 0 12px rgba(254,145,0,0.5)' }} />
                          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] sm:tracking-[0.22em] uppercase whitespace-nowrap" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(233,215,196,0.92)' }}>
                            ARAS AI® Intelligence Briefing
                          </span>
                        </motion.div>
                        
                        <motion.h2 
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12, type: "spring", stiffness: 200 }}
                          className="text-xl sm:text-2xl md:text-3xl font-black truncate"
                          style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '-0.01em', background: 'linear-gradient(90deg, #e9d7c4 0%, #FE9100 40%, #a34e00 80%, #e9d7c4 100%)', backgroundSize: '300% auto', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'briefingSheen 6s linear infinite' }}
                        >
                          {companyName}
                        </motion.h2>
                        
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="text-sm text-gray-400 max-w-2xl leading-relaxed"
                        >
                          Hey <span className="text-white font-semibold">{(user as any)?.firstName}</span> — ich habe {companyName} mit Live-Recherche analysiert. Hier ist dein persönliches Company-Intelligence-Profil.
                        </motion.p>
                      </div>

                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        onClick={() => setShowWelcome(false)}
                        className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-all duration-300 group border border-[#e9d7c4]/10 hover:border-[#FE9100]/30"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                      </motion.button>
                    </div>

                    {/* ═══ COMPANY DESCRIPTION — Hero Card ═══ */}
                    {companyDescription && companyDescription.length > 20 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl p-5 border border-[#FE9100]/20 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(254,145,0,0.08) 0%, rgba(255,255,255,0.012) 100%)', boxShadow: '0 18px 60px rgba(0,0,0,0.4)' }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(500px 200px at 20% 30%, rgba(254,145,0,0.06), transparent 60%)' }} />
                        <div className="relative flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <Building2 className="w-5 h-5 text-[#e9d7c4]/90" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: 'rgba(233,215,196,0.9)' }}>Unternehmensprofil</h3>
                              {aiProfile?.foundedYear && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#e9d7c4]/12 text-gray-500">seit {aiProfile.foundedYear}</span>}
                              {aiProfile?.headquarters && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#e9d7c4]/12 text-gray-500">📍 {aiProfile.headquarters}</span>}
                              {aiProfile?.employeeCount && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#e9d7c4]/12 text-gray-500">👥 {aiProfile.employeeCount}</span>}
                            </div>
                            <p className="text-[13px] text-gray-300 leading-relaxed break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                              {companyDescription.length > 400 ? companyDescription.slice(0, 400) + '…' : companyDescription}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ═══ MAIN GRID — 3 columns ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">

                      {/* 🎯 GOAL + BRAND VOICE */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-3 min-w-0 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <Target className="w-4 h-4 text-[#e9d7c4]/90" />
                          </div>
                          <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Hauptziel</h3>
                        </div>
                        <p className="text-sm font-semibold text-white break-words">
                          {(user as any)?.primaryGoal?.replace(/_/g, ' ') || 'Lead Generation'}
                        </p>
                        {aiProfile?.brandVoice && (
                          <div className="pt-2 border-t border-white/5 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Quote className="w-3 h-3 text-[#FE9100]/60 flex-shrink-0" />
                              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500">Brand Voice</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 break-words" style={{ overflowWrap: 'break-word' }}>{aiProfile.brandVoice}</p>
                          </div>
                        )}
                      </motion.div>

                      {/* 👥 TARGET AUDIENCE */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2 min-w-0 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <Users className="w-4 h-4 text-[#e9d7c4]/90" />
                          </div>
                          <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Zielgruppe</h3>
                        </div>
                        {aiProfile?.targetAudience && (
                          <p className="text-xs text-gray-300 leading-relaxed line-clamp-3 break-words" style={{ overflowWrap: 'break-word' }}>{aiProfile.targetAudience}</p>
                        )}
                        {Array.isArray(aiProfile?.targetAudienceSegments) && aiProfile.targetAudienceSegments.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {aiProfile.targetAudienceSegments.slice(0, 4).map((seg: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-[#FE9100]/15 text-[#FE9100]/80 bg-[#FE9100]/5 truncate max-w-[200px]">{seg}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>

                      {/* ⚔️ COMPETITORS */}
                      {(() => {
                        const list = Array.isArray(aiProfile?.competitors) ? aiProfile.competitors.filter(Boolean) : [];
                        if (list.length === 0) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2 min-w-0 overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <Swords className="w-4 h-4 text-[#e9d7c4]/90" />
                              </div>
                              <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Wettbewerber</h3>
                            </div>
                            <ul className="space-y-1">
                              {list.slice(0, 5).map((c: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                  <ChevronRight className="w-3 h-3 text-[#FE9100]/40 flex-shrink-0" />
                                  <span className="line-clamp-1">{c}</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        );
                      })()}
                    </div>

                    {/* ═══ SECOND ROW — Products, Services, USPs ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">

                      {/* 📦 PRODUCTS */}
                      {(() => {
                        const list = Array.isArray(aiProfile?.products) ? aiProfile.products.filter(Boolean) : [];
                        if (list.length === 0) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2 min-w-0 overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <Sparkles className="w-4 h-4 text-[#e9d7c4]/90" />
                              </div>
                              <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Produkte</h3>
                              <span className="text-[10px] text-gray-600 ml-auto">{list.length}</span>
                            </div>
                            <ul className="space-y-1">
                              {list.slice(0, 5).map((p: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                  <div className="w-1 h-1 rounded-full bg-[#FE9100]/50 flex-shrink-0" />
                                  <span className="line-clamp-1">{p}</span>
                                </li>
                              ))}
                              {list.length > 5 && <li className="text-[10px] text-[#FE9100] font-semibold pl-3">+{list.length - 5} weitere</li>}
                            </ul>
                          </motion.div>
                        );
                      })()}

                      {/* 🛠️ SERVICES */}
                      {(() => {
                        const raw = aiProfile?.services;
                        const list: string[] = Array.isArray(raw) ? raw.filter(Boolean) : (typeof raw === 'string' && raw.trim() ? raw.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean) : []);
                        if (list.length === 0) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2 min-w-0 overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <Shield className="w-4 h-4 text-[#e9d7c4]/90" />
                              </div>
                              <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Services</h3>
                              <span className="text-[10px] text-gray-600 ml-auto">{list.length}</span>
                            </div>
                            <ul className="space-y-1">
                              {list.slice(0, 5).map((s: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                  <div className="w-1 h-1 rounded-full bg-[#FE9100]/50 flex-shrink-0" />
                                  <span className="line-clamp-1">{s}</span>
                                </li>
                              ))}
                              {list.length > 5 && <li className="text-[10px] text-[#FE9100] font-semibold pl-3">+{list.length - 5} weitere</li>}
                            </ul>
                          </motion.div>
                        );
                      })()}

                      {/* 💎 USPs */}
                      {(() => {
                        const list = Array.isArray(aiProfile?.uniqueSellingPoints) ? aiProfile.uniqueSellingPoints.filter(Boolean) : [];
                        if (list.length === 0) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="rounded-xl p-4 border border-[#FE9100]/15 space-y-2 min-w-0 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, rgba(254,145,0,0.04) 0%, rgba(255,255,255,0.01) 100%)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-[#FE9100]/20 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(254,145,0,0.06)' }}>
                                <TrendingUp className="w-4 h-4 text-[#FE9100]" />
                              </div>
                              <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#FE9100]/70">USPs</h3>
                            </div>
                            <ul className="space-y-1">
                              {list.slice(0, 5).map((u: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-300">
                                  <div className="w-1 h-1 rounded-full bg-[#FE9100] flex-shrink-0" />
                                  <span className="line-clamp-1">{u}</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        );
                      })()}
                    </div>

                    {/* ═══ THIRD ROW — Keywords + Call Angles ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">

                      {/* 🔑 KEYWORDS */}
                      {Array.isArray(aiProfile?.effectiveKeywords) && aiProfile.effectiveKeywords.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.55 }}
                          className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2.5 min-w-0 overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <Key className="w-4 h-4 text-[#e9d7c4]/90" />
                            </div>
                            <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Top Keywords</h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {aiProfile.effectiveKeywords.slice(0, 12).map((kw: string, i: number) => (
                              <span key={i} className="text-[10px] px-2.5 py-1 rounded-full font-medium border border-[#FE9100]/15 text-[#FE9100]/85 bg-[#FE9100]/5 hover:bg-[#FE9100]/10 transition-colors cursor-default">{kw}</span>
                            ))}
                            {aiProfile.effectiveKeywords.length > 12 && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-gray-500">+{aiProfile.effectiveKeywords.length - 12}</span>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* 📞 CALL ANGLES */}
                      {(() => {
                        const list = Array.isArray(aiProfile?.callAngles) ? aiProfile.callAngles.filter(Boolean) : [];
                        if (list.length === 0) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="rounded-xl p-4 border border-[#e9d7c4]/10 space-y-2 min-w-0 overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.014)', boxShadow: '0 16px 52px rgba(0,0,0,0.35)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-[#e9d7c4]/14 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <Phone className="w-4 h-4 text-[#e9d7c4]/90" />
                              </div>
                              <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">Call Angles</h3>
                            </div>
                            <ul className="space-y-1.5">
                              {list.slice(0, 4).map((angle: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                  <ArrowRight className="w-3 h-3 text-[#FE9100]/50 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2">{angle}</span>
                                </li>
                              ))}
                              {list.length > 4 && <li className="text-[10px] text-[#FE9100] font-semibold pl-5">+{list.length - 4} weitere Angles</li>}
                            </ul>
                          </motion.div>
                        );
                      })()}
                    </div>

                  </div>
                </div>

                {/* Auto-hide progress bar */}
                <motion.div
                  className="absolute bottom-0 left-0 h-[2px] z-[2]"
                  style={{ background: 'linear-gradient(90deg, #FE9100, #a34e00)' }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 20, ease: "linear" }}
                />

                {/* Keyframes for briefing header shimmer */}
                <style>{`@keyframes briefingSheen{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Main Chat Interface - wrapped in ErrorBoundary */}
          <div className="flex-1 overflow-hidden relative">
            <ErrorBoundary fallbackTitle="Chat konnte nicht geladen werden">
              <ChatInterface />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
