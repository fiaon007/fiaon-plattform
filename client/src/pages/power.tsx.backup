import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Lock, Phone, Contact, Plus, X, Building2, User, Mail, StickyNote, ChevronDown, Search, Sparkles, Loader2 } from 'lucide-react';
import type { SubscriptionResponse } from "@shared/schema";
import arasLogo from "@/assets/aras_logo_1755067745303.png";
import { CallWizard } from '@/components/power/call-wizard';
import { ClarificationChat } from '@/components/power/clarification-chat';
import { CallTimeline } from '@/components/power/call-timeline';
import { PowerResultCard } from '@/components/power/power-result-card';
// Templates entfernt aus POWER - bleiben im Code für spätere Features

// ----------------- ARAS CI -----------------
const CI = {
  goldLight: '#E9D7C4',
  orange: '#FE9100',
  goldDark: '#A34E00',
  black: '#0a0a0a'
};

const ANIMATED_TEXTS = [
  "Terminvereinbarungen automatisieren",
  "Leads qualifizieren",
  "Kundentermine bestätigen",
  "Follow-ups durchführen",
  "Feedback einholen",
  "Bestellungen aufnehmen"
];

const EXAMPLE_PROMPTS = [
  { text: 'Akquiriere Kunden für meine Dienstleistung XY' },
  { text: 'Lade Besucher zu unserem Event ein' },
  { text: 'Reaktiviere Bestandskunden mit einem kurzen Angebot' },
  { text: 'Qualifiziere neue Leads aus der letzten Messe' },
];

const validatePhoneNumber = (phone: string): boolean => /^\+[0-9]{10,15}$/.test(phone);
const formatPhoneInput = (value: string): string => value.replace(/[^\d+]/g, '');

export default function Power() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // 🔥 NEW: Load user profile context for AI-enhanced calls
  const { 
    data: userProfileContext, 
    isLoading: isProfileLoading, 
    isError: isProfileError 
  } = useQuery({
    queryKey: ["user-profile-context"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile-context", {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to load profile context");
      }
      return res.json();
    },
    // Nur laden wenn User eingeloggt
    enabled: !!user,
    // Cache für 5 Minuten
    staleTime: 5 * 60 * 1000
  });

  // Existing states (technical behaviour untouched)
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [phoneError, setPhoneError] = useState("");
  
  // 🎯 Call Summary from ARAS Core
  const [callSummary, setCallSummary] = useState<{
    outcome: string;
    bulletPoints: string[];
    nextStep: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    tags: string[];
  } | null>(null);
  
  // NEW: Kontaktbuch Integration
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [newContactData, setNewContactData] = useState({
    company: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: ""
  });

  // UI/typing
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  // Call status tracking
  const [callStatus, setCallStatus] = useState<'idle' | 'processing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // NEW (UI only, no backend): bulk campaign inputs
  const [campaignGoal, setCampaignGoal] = useState("");
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  
  // 🔥 NEW: Wizard State
  const [showWizard, setShowWizard] = useState(false);
  
  // 🔥 NEW: Chat Clarification Flow
  const [showChatFlow, setShowChatFlow] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [chatAnswers, setChatAnswers] = useState<Record<string, string>>({});
  const [enhancedPrompt, setEnhancedPrompt] = useState<string>('');
  const [showReview, setShowReview] = useState(false);

  // Contact ID für Contact-Kontext (ohne Templates)
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch call history from database
  useEffect(() => {
    const fetchCallHistory = async () => {
      try {
        const response = await fetch('/api/user/call-logs', {
          credentials: 'include'
        });
        if (response.ok) {
          const logs = await response.json();
          setCallHistory(logs);
        }
      } catch (error) {
        console.error('[CALL-HISTORY] Error fetching:', error);
      }
    };
    
    fetchCallHistory();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCallHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch subscription
  const { data: subscription, refetch: refetchSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  // Fetch contacts from new API
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });

  const subscriptionData = subscription || {
    plan: 'pro',
    status: 'active',
    aiMessagesUsed: 0,
    voiceCallsUsed: 0,
    aiMessagesLimit: 100,
    voiceCallsLimit: 100,
    renewalDate: new Date().toISOString(),
    hasPaymentMethod: false,
    requiresPaymentSetup: false,
    isTrialActive: false,
    canUpgrade: false
  };

  // ----------------- Minimal helper UI (unchanged networking) -----------------
  // NEW: Select contact from phonebook
  const handleSelectContact = (contact: any) => {
    setContactName(contact.company || `${contact.firstName || ''} ${contact.lastName || ''}`.trim());
    setPhoneNumber(contact.phone || contact.phoneNumber || '');
    setSelectedContactId(contact.id || null); // 🔥 Speichere contactId für Template-Personalisierung
    setShowContactPicker(false);
    toast({
      title: 'Kontakt ausgewählt',
      description: `${contact.company || 'Kontakt'} wurde ausgewählt`
    });
  };

  // Template-Handler entfernt - POWER fokussiert sich auf freien Text

  // NEW: Save new contact with all fields
  const handleSaveNewContact = async () => {
    if (!newContactData.company.trim()) {
      toast({
        title: 'Firma erforderlich',
        description: 'Bitte geben Sie mindestens einen Firmennamen ein.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newContactData)
      });

      if (!response.ok) throw new Error('Save failed');

      const savedContact = await response.json();
      
      // Fill form with new contact
      setContactName(savedContact.company);
      setPhoneNumber(savedContact.phone || '');
      
      // Reset and close
      setNewContactData({
        company: '',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        notes: ''
      });
      setShowNewContactModal(false);
      
      toast({
        title: 'Kontakt gespeichert',
        description: `${savedContact.company} wurde zu Ihrem Kontaktbuch hinzugefügt`
      });
    } catch {
      toast({
        title: 'Fehler',
        description: 'Kontakt konnte nicht gespeichert werden',
        variant: 'destructive'
      });
    }
  };

  // Filter contacts for picker
  const filteredContacts = contacts.filter(c => 
    contactSearchQuery === '' ||
    c.company?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    c.firstName?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    c.lastName?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    c.phone?.includes(contactSearchQuery)
  );

  useEffect(() => {
    if (phoneNumber && validatePhoneNumber(phoneNumber)) {
      fetch(`/api/user/call-history/${encodeURIComponent(phoneNumber)}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => setCallHistory(data || []))
        .catch(() => {});
    } else {
      setCallHistory([]);
    }
  }, [phoneNumber]);

  const handleSectionChange = (section: string) => {
    if (section !== "power") window.location.href = `/app/${section}`;
  };

  // Typewriter
  useEffect(() => {
    const currentText = ANIMATED_TEXTS[currentTextIndex];
    let charIndex = 0;
    if (isTyping) {
      const typeInterval = setInterval(() => {
        if (charIndex <= currentText.length) {
          setDisplayText(currentText.substring(0, charIndex));
          charIndex++;
        } else {
          setIsTyping(false);
          setTimeout(() => {
            setIsTyping(true);
            setCurrentTextIndex((prev) => (prev + 1) % ANIMATED_TEXTS.length);
          }, 1600);
          clearInterval(typeInterval);
        }
      }, 45);
      return () => clearInterval(typeInterval);
    }
  }, [currentTextIndex, isTyping]);

  // autoresize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [message]);

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneInput(value);
    setPhoneNumber(formatted);
    setPhoneError(formatted && !validatePhoneNumber(formatted) ? "Format: +4917661119320 (ohne Leerzeichen)" : "");
  };

  // ----------------- UI ONLY: bulk list drop -----------------
  const onBulkFilePick = (f?: File) => {
    if (!f) return;
    const ok = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!ok.includes(f.type) && !f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
      toast({ title: 'Dateityp', description: 'Bitte CSV oder XLSX hochladen', variant: 'destructive' });
      return;
    }
    setBulkFileName(f.name);
    // UI only – keine Verarbeitung
  };

  // ----------------- 🔥 NEUE CALL LOGIC MIT CHAT-FLOW -----------------
  // Schritt 1: Starte Chat-Flow (Validierung mit Gemini)
  const handleStartCallProcess = async () => {
    if (!contactName || !phoneNumber || !message) {
      toast({ 
        title: "Fehlende Angaben", 
        description: "Bitte fülle alle Pflichtfelder aus", 
        variant: "destructive" 
      });
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      toast({ 
        title: "Ungültige Telefonnummer", 
        description: "Format: +4917661119320 (ohne Leerzeichen)", 
        variant: "destructive" 
      });
      return;
    }
    
    // Starte Validierung mit ARAS Core
    setLoading(true);
    try {
      const response = await fetch('/api/aras-voice/validate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          contactName,
          answers: {},
          contactId: selectedContactId
          // Kein templateId/templateScenario mehr - POWER nutzt freien Text
        })
      });

      if (!response.ok) {
        throw new Error('Validierung fehlgeschlagen');
      }

      const result = await response.json();
      setValidationResult(result);

      if (result.isComplete) {
        // Direkt zum Review, keine Fragen
        setEnhancedPrompt(result.enhancedPrompt || message);
        setShowReview(true);
      } else if (result.questions && result.questions.length > 0) {
        // Zeige Chat-Flow für Fragen
        setShowChatFlow(true);
      } else {
        // Fallback: Direkt Call
        setEnhancedPrompt(message);
        setShowReview(true);
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Schritt 2: Chat-Flow abgeschlossen
  const handleChatComplete = (answers: Record<string, string>) => {
    setChatAnswers(answers);
    
    // Baue Enhanced Prompt aus Antworten
    const prompt = `${message}\n\nZusätzliche Details:\n${Object.entries(answers)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n')}`;
    
    setEnhancedPrompt(validationResult?.enhancedPrompt || prompt);
    setShowChatFlow(false);
    setShowReview(true);
  };

  // Schritt 3: Chat überspringen
  const handleSkipChat = () => {
    setEnhancedPrompt(message);
    setShowChatFlow(false);
    setShowReview(true);
  };

  // Schritt 4: Review bestätigt → Call starten
  const handleConfirmCall = async () => {
    setShowReview(false);
    setLoading(true);
    setResult(null);
    setCallStatus('processing');
    setCallDuration(0);

    try {
      const response = await fetch("/api/aras-voice/smart-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          name: contactName,
          phoneNumber: phoneNumber,
          message: enhancedPrompt
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        setLoading(false);
        setCallStatus('idle');
        setResult({ success: false, error: data.error || data.message || `Fehler: ${response.status}` });
        return;
      }
      
      if (data.success && data.callId) {
        const callId = data.callId;
        setCallStatus('ringing');
        
        toast({
          title: "🚀 Anruf gestartet",
          description: `ARAS AI ruft jetzt ${contactName} an...`
        });
        
        // Nach 3s: connected
        setTimeout(() => {
          setCallStatus('connected');
          callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }, 3000);
        
        // Start polling
        setTimeout(() => pollCallDetails(callId), 5000);
      } else {
        setCallStatus('idle');
        setResult(data);
      }
      
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setCallStatus('idle');
      setResult({ success: false, error: e?.message || "Anruf fehlgeschlagen" });
    }
  };
  
  // Polling Logic
  const pollCallDetails = async (callId: number) => {
    let attempts = 0;
    const maxAttempts = 30;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const detailsResponse = await fetch(`/api/aras-voice/call-details/${callId}`, {
          credentials: 'include'
        });
        
        if (!detailsResponse.ok) {
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
            }
            setCallStatus('ended');
            setResult({ success: false, error: 'Anruf-Details konnten nicht abgerufen werden' });
          }
          return;
        }
        
        const callDetails = await detailsResponse.json();
        const hasTranscript = !!callDetails.transcript;
        const hasAudio = !!callDetails.recordingUrl;
        const isCompleted = callDetails.status === 'completed' || callDetails.status === 'done';
        
        if (hasTranscript) {
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
          setCallStatus('ended');
          
          setResult({
            success: true,
            id: callDetails.id || callDetails.callId,
            recordingUrl: callDetails.recordingUrl || null,
            transcript: callDetails.transcript,
            duration: callDetails.duration || callDuration,
            phoneNumber: callDetails.phoneNumber || phoneNumber,
            contactName: callDetails.contactName || contactName
          });
          
          // 🎯 Extract & Set Summary from ARAS Core
          if (callDetails.summary) {
            setCallSummary({
              outcome: callDetails.summary.outcome ?? '',
              bulletPoints: Array.isArray(callDetails.summary.bulletPoints) ? callDetails.summary.bulletPoints : [],
              nextStep: callDetails.summary.nextStep ?? '',
              sentiment: callDetails.summary.sentiment ?? 'neutral',
              tags: Array.isArray(callDetails.summary.tags) ? callDetails.summary.tags : []
            });
          } else {
            setCallSummary(null);
          }
          
          // 🔥 NEUE TOAST-BENACHRICHTIGUNG
          toast({
            title: "✅ Anruf abgeschlossen",
            description: `Der Anruf an ${contactName} wurde erfolgreich beendet. Transkript und Aufzeichnung sind verfügbar.`,
          });
          
          // Refresh call history
          try {
            const historyResponse = await fetch('/api/user/call-logs', { credentials: 'include' });
            if (historyResponse.ok) {
              const logs = await historyResponse.json();
              setCallHistory(logs);
            }
          } catch (e) {
            console.error('Failed to refresh history:', e);
          }
          
          if (hasAudio || isCompleted) {
            clearInterval(pollInterval);
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
          setCallStatus('ended');
          setResult({
            success: true,
            callId: callDetails.callId,
            transcript: 'Anruf wurde durchgeführt. Details werden verarbeitet.',
            duration: callDuration
          });
        }
      } catch (pollError) {
        console.error('Polling error:', pollError);
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
          setCallStatus('ended');
          setResult({ success: false, error: 'Fehler beim Abrufen der Anrufdaten' });
        }
      }
    }, 4000);
    
    // Safety timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (callStatus !== 'ended') {
        setCallStatus('ended');
        setResult({
          success: true,
          transcript: 'Anruf beendet. Details werden verarbeitet.',
          duration: callDuration
        });
      }
    }, 150000);
  };

  // Reset für neuen Call
  const handleNewCall = () => {
    setResult(null);
    setCallSummary(null); // 🎯 Reset Summary
    setCallStatus('idle');
    setCallDuration(0);
    setShowReview(false);
    setShowChatFlow(false);
    setEnhancedPrompt('');
    setChatAnswers({});
    setValidationResult(null);
    setContactName('');
    setPhoneNumber('');
    setMessage('');
  };
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);
  
  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------- UI -----------------
  return (
    <div className="flex h-screen relative overflow-hidden">
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
        activeSection="power"
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden content-zoom">
        <TopBar
          currentSection="power"
          subscriptionData={subscriptionData}
          user={user as import("@shared/schema").User}
          isVisible={true}
        />

        <div className="flex-1 overflow-y-auto premium-scroll">
          <div className="max-w-6xl mx-auto px-6 py-10">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <motion.h1
                className="text-[44px] md:text-[56px] font-black tracking-tight mb-4"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
                initial={{ letterSpacing: '-0.02em' }}
                animate={{ letterSpacing: ['-0.02em', '-0.01em', '-0.02em'] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span
                  style={{
                    background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark}, ${CI.orange}, ${CI.goldLight})`,
                    backgroundSize: '300% 100%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                  className="inline-block"
                >
                  POWER
                </span>
              </motion.h1>

              <div className="flex items-center justify-center gap-2 text-[15px]">
                <span className="text-gray-500">ARAS AI erledigt:</span>
                <motion.span
                  className="font-semibold min-w-[280px] text-left"
                  style={{ color: CI.orange, fontFamily: 'Orbitron, sans-serif' }}
                >
                  {displayText}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="inline-block w-[2px] h-[20px] ml-1 align-middle"
                    style={{ background: CI.orange }}
                  />
                </motion.span>
              </div>

              {/* Credo */}
              <div className="mt-4 text-[13px] text-gray-400">
                <span
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  ARAS analysiert <span style={{ color: CI.goldLight }}>bis zu 500</span> öffentlich verfügbare Quellen pro Kontakt
                  und passt Tonalität, Argumente und Reihenfolge dynamisch an – in Echtzeit.
                </span>
              </div>
            </motion.div>

            {/* Grid: Left (Single Call) / Right (Bulk Campaign) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* LEFT: Single Call form (smaller, clean) */}
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div
                  className="relative rounded-2xl p-7"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {/* brand tag */}
                  <div className="mb-7 flex items-center justify-center">
                    <img src={arasLogo} alt="ARAS" className="w-7 h-7 object-contain mr-2" />
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
                      ARAS AI • Core PRO 1.0
                    </div>
                  </div>

                  {/* 🔥 Firmenprofil-Status */}
                  {isProfileLoading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 p-3 rounded-xl text-xs"
                      style={{
                        background: 'rgba(254,145,0,0.08)',
                        border: '1px solid rgba(254,145,0,0.2)',
                        color: '#d1d5db'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: CI.orange }} />
                        <span>Lade dein Firmenprofil...</span>
                      </div>
                    </motion.div>
                  )}
                  
                  {isProfileError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 p-3 rounded-xl text-xs"
                      style={{
                        background: 'rgba(234,179,8,0.08)',
                        border: '1px solid rgba(234,179,8,0.25)',
                        color: '#fbbf24'
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">⚠️</span>
                        <div>
                          <div className="font-semibold mb-1">Firmenprofil nicht verfügbar</div>
                          <div className="text-[11px] text-gray-400">
                            ARAS konnte dein Firmenprofil gerade nicht laden. Der Anruf funktioniert trotzdem – nur ohne personalisierte Firmendaten.
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {!isProfileLoading && !isProfileError && userProfileContext?.company && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 p-3 rounded-xl text-xs"
                      style={{
                        background: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        color: '#4ade80'
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">✅</span>
                        <div>
                          <div className="font-semibold mb-1">Firmenprofil aktiv</div>
                          <div className="text-[11px] text-gray-400">
                            ARAS nutzt dein Profil ({userProfileContext.company}
                            {userProfileContext.industry && `, ${userProfileContext.industry}`}) um Gespräche auf deine Zielkunden zuzuschneiden.
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-5">
                    {/* Contact - MODERN with Kontaktbuch */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[12px] font-medium text-gray-300">Gesprächspartner</label>
                        <div className="flex gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowContactPicker(true)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1"
                            style={{
                              background: `linear-gradient(135deg, ${CI.goldLight}15, ${CI.orange}10)`,
                              border: `1px solid ${CI.goldLight}30`,
                              color: CI.goldLight
                            }}
                          >
                            <Contact className="w-3 h-3" />
                            Wählen
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowNewContactModal(true)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1"
                            style={{
                              background: `linear-gradient(135deg, ${CI.orange}15, ${CI.goldDark}10)`,
                              border: `1px solid ${CI.orange}30`,
                              color: CI.orange
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            Neu
                          </motion.button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Name oder Firma eingeben…"
                        className="w-full px-4 py-[11px] rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          boxShadow: '0 0 0 0 rgba(254,145,0,0)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-[12px] font-medium text-gray-300 mb-2">Telefonnummer</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="+49…"
                        className="w-full px-4 py-[11px] rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: phoneError ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.10)',
                          boxShadow: '0 0 0 0 rgba(254,145,0,0)'
                        }}
                        onFocus={(e) => { if (!phoneError) { e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)'; }}}
                        onBlur={(e) => { if (!phoneError) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}}
                      />
                      {phoneError && <p className="mt-1 text-[11px]" style={{ color: '#f87171' }}>{phoneError}</p>}
                    </div>

                    {/* Message - Freier Text */}
                    <div>
                      <label className="block text-[12px] font-medium text-gray-300 mb-2">Ziel der Nachricht</label>
                      <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Freitext. Beispiel: Bitte vereinbaren Sie einen Termin für nächste Woche Dienstag oder Donnerstag…"
                        className="w-full px-4 py-[11px] rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all resize-none"
                        style={{
                          minHeight: 110,
                          maxHeight: 170,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.10)'
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(254,145,0,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(254,145,0,0.08)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      <div className="mt-1 text-right text-[11px] text-gray-500">{message.length} / 500</div>
                    </div>

                    {/* Call Status Display */}
                    {callStatus !== 'idle' && (
                      <div className="mb-4 p-3 rounded-lg text-center" style={{
                        background: callStatus === 'processing' ? 'rgba(234,179,8,0.1)' :
                                   callStatus === 'ringing' ? 'rgba(59,130,246,0.1)' :
                                   callStatus === 'connected' ? 'rgba(34,197,94,0.1)' :
                                   'rgba(107,114,128,0.1)',
                        border: `1px solid ${callStatus === 'processing' ? 'rgba(234,179,8,0.3)' :
                                callStatus === 'ringing' ? 'rgba(59,130,246,0.3)' :
                                callStatus === 'connected' ? 'rgba(34,197,94,0.3)' :
                                'rgba(107,114,128,0.3)'}`
                      }}>
                        <div className="text-sm font-medium" style={{
                          color: callStatus === 'processing' ? '#fbbf24' :
                                 callStatus === 'ringing' ? '#60a5fa' :
                                 callStatus === 'connected' ? '#4ade80' :
                                 '#9ca3af'
                        }}>
                          {callStatus === 'processing' ? 'Anruf wird vorbereitet...' :
                           callStatus === 'ringing' ? 'Verbindung wird hergestellt...' :
                           callStatus === 'connected' ? `Gespräch läuft: ${formatCallDuration(callDuration)}` :
                           'Anruf beendet'}
                        </div>
                      </div>
                    )}
                    
                    {/* Call button */}
                    <div className="pt-1">
                      <button
                        onClick={handleStartCallProcess}
                        disabled={loading || !phoneNumber || !contactName || !message || !!phoneError || callStatus !== 'idle'}
                        className="w-full py-3 rounded-full font-semibold text-sm transition-all"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          background: (loading || !phoneNumber || !contactName || !message || phoneError || callStatus !== 'idle')
                            ? 'rgba(45,45,45,0.6)'
                            : `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark})`,
                          backgroundSize: '220% 100%',
                          color: (loading || !phoneNumber || !contactName || !message || phoneError || callStatus !== 'idle') ? 'rgba(170,170,170,0.6)' : '#fff'
                        }}
                        onMouseEnter={(e) => { if (!(loading || !phoneNumber || !contactName || !message || phoneError || callStatus !== 'idle')) (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 50%'; }}
                        onMouseLeave={(e) => { if (!(loading || !phoneNumber || !contactName || !message || phoneError || callStatus !== 'idle')) (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 50%'; }}
                      >
                        {callStatus === 'processing' ? 'Verarbeitung...' :
                         callStatus === 'ringing' ? 'Wird verbunden...' :
                         callStatus === 'connected' ? 'Gespräch läuft...' :
                         loading ? 'Anruf wird gestartet...' : 'Jetzt anrufen lassen'}
                      </button>
                    </div>
                  </div>

                  {/* Result with Audio and Transcript */}
                  <AnimatePresence>
                    {result && callStatus === 'ended' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6 rounded-xl p-5"
                        style={{
                          background: 'linear-gradient(135deg, rgba(254,145,0,0.05), rgba(233,215,196,0.03))',
                          border: '1px solid rgba(254,145,0,0.2)'
                        }}
                      >
                        <div className="mb-3">
                          <h4 className="text-sm font-bold" style={{ color: CI.orange }}>Anrufergebnis</h4>
                        </div>
                        
                        {result.success ? (
                          <>
                            {/* Audio Player with Download */}
                            {result.recordingUrl ? (
                              <div className="mb-4">
                                <div className="text-[11px] font-medium mb-2" style={{ color: CI.goldLight }}>Aufzeichnung</div>
                                <audio controls className="w-full mb-2" style={{ height: '36px' }}>
                                  <source src={result.recordingUrl} type="audio/mpeg" />
                                  <source src={result.recordingUrl} type="audio/wav" />
                                  Browser unterstützt keine Audio-Wiedergabe.
                                </audio>
                                <a 
                                  href={result.recordingUrl} 
                                  download={`ARAS_Anruf_${new Date().toISOString().split('T')[0]}_${Date.now()}.mp3`}
                                  className="inline-block text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all"
                                  style={{ 
                                    color: CI.orange,
                                    background: 'rgba(254,145,0,0.1)',
                                    border: '1px solid rgba(254,145,0,0.2)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(254,145,0,0.2)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(254,145,0,0.1)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }}
                                >
                                  Audio herunterladen
                                </a>
                              </div>
                            ) : (
                              <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <p className="text-[11px] text-gray-500">Audio wird noch verarbeitet...</p>
                              </div>
                            )}
                            
                            {/* Transcript */}
                            {result.transcript && (
                              <div className="mb-4">
                                <div className="text-[11px] font-medium mb-2" style={{ color: CI.goldLight }}>Transkript</div>
                                <div 
                                  className="text-[12px] text-gray-300 leading-relaxed p-3 rounded-lg overflow-y-auto"
                                  style={{ 
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    maxHeight: '400px'
                                  }}
                                >
                                  <pre className="whitespace-pre-wrap font-sans">
                                    {(() => {
                                      // Handle transcript that might be string or array
                                      if (typeof result.transcript === 'string') {
                                        // Already cleaned by backend
                                        return result.transcript;
                                      } else if (Array.isArray(result.transcript)) {
                                        // Parse array format (fallback if backend didn't clean)
                                        return result.transcript
                                          .filter((turn: any) => turn.message && turn.message.trim() !== '...')
                                          .map((turn: any) => {
                                            const role = turn.role === 'agent' ? 'ARAS AI' : 'Kunde';
                                            const message = turn.original_message || turn.message;
                                            return `${role}: ${message.trim()}`;
                                          })
                                          .join('\n\n');
                                      } else {
                                        return JSON.stringify(result.transcript, null, 2);
                                      }
                                    })()}
                                  </pre>
                                </div>
                              </div>
                            )}
                            
                            {result.duration && (
                              <p className="text-[11px] text-gray-500 mb-3">
                                Dauer: {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')} Min
                              </p>
                            )}
                            
                            {/* Reset Button */}
                            <button
                              onClick={() => {
                                setResult(null);
                                setCallStatus('idle');
                                setCallDuration(0);
                              }}
                              className="text-[12px] font-medium transition-all"
                              style={{ color: CI.orange }}
                              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                              Neuer Anruf starten
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-red-300 text-sm">{result.error || 'Fehler beim Anruf'}</p>
                            <button
                              onClick={() => {
                                setResult(null);
                                setCallStatus('idle');
                              }}
                              className="mt-2 text-[12px] font-medium"
                              style={{ color: CI.orange }}
                            >
                              Erneut versuchen
                            </button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Call History Button & Collapsible Section */}
                  {callHistory.length > 0 && (
                    <div className="mt-7">
                      {/* Toggle Button */}
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full py-3 px-4 rounded-xl font-medium text-[13px] transition-all"
                        style={{
                          background: showHistory 
                            ? 'linear-gradient(135deg, rgba(254,145,0,0.15), rgba(233,215,196,0.08))' 
                            : 'rgba(255,255,255,0.03)',
                          border: showHistory 
                            ? '1px solid rgba(254,145,0,0.3)' 
                            : '1px solid rgba(255,255,255,0.08)',
                          color: showHistory ? CI.orange : '#9ca3af'
                        }}
                        onMouseEnter={(e) => {
                          if (!showHistory) {
                            e.currentTarget.style.borderColor = 'rgba(254,145,0,0.2)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showHistory) {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            {showHistory ? 'Verlauf ausblenden' : `Gesprächsverlauf anzeigen (${callHistory.length})`}
                          </span>
                          <span className="text-[16px]">
                            {showHistory ? '▴' : '▾'}
                          </span>
                        </div>
                      </button>
                      
                      {/* Collapsible History */}
                      <AnimatePresence>
                        {showHistory && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 space-y-3">
                        {callHistory.slice(0, 10).map((call) => (
                          <div
                            key={call.id}
                            className="rounded-lg overflow-hidden transition-all"
                            style={{
                              background: expandedCall === call.id 
                                ? 'linear-gradient(135deg, rgba(254,145,0,0.08), rgba(233,215,196,0.05))' 
                                : 'rgba(255,255,255,0.03)',
                              border: expandedCall === call.id
                                ? '1px solid rgba(254,145,0,0.3)'
                                : '1px solid rgba(255,255,255,0.08)'
                            }}
                          >
                            {/* Header - Always visible */}
                            <div 
                              className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                              onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium text-white">
                                      {call.phoneNumber}
                                    </div>
                                    <div className="text-[11px] px-2 py-0.5 rounded-full" style={{
                                      background: call.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)',
                                      color: call.status === 'completed' ? '#4ade80' : '#9ca3af'
                                    }}>
                                      {call.status === 'completed' ? 'Erfolgreich' : call.status}
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-1">
                                    {new Date(call.createdAt).toLocaleDateString('de-DE', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                    {call.duration && ` • ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')} Min`}
                                  </div>
                                </div>
                                <div className="text-[11px]" style={{ color: CI.orange }}>
                                  {expandedCall === call.id ? '▴ Schließen' : '▾ Details'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Content */}
                            {expandedCall === call.id && (
                              <div className="px-3 pb-3 border-t border-white/5">
                                {/* Audio Player with Download */}
                                {call.recordingUrl ? (
                                  <div className="mt-3">
                                    <div className="text-[11px] font-medium mb-2" style={{ color: CI.goldLight }}>Aufzeichnung</div>
                                    <audio controls className="w-full mb-2" style={{ height: '32px' }}>
                                      <source src={call.recordingUrl} type="audio/mpeg" />
                                      <source src={call.recordingUrl} type="audio/wav" />
                                      Browser unterstützt keine Audio-Wiedergabe.
                                    </audio>
                                    <a 
                                      href={call.recordingUrl} 
                                      download={`ARAS_Anruf_${call.phoneNumber}_${new Date(call.createdAt).toISOString().split('T')[0]}.mp3`}
                                      className="inline-block text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all"
                                      style={{ 
                                        color: CI.orange,
                                        background: 'rgba(254,145,0,0.1)',
                                        border: '1px solid rgba(254,145,0,0.2)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(254,145,0,0.2)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(254,145,0,0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }}
                                    >
                                      Audio herunterladen
                                    </a>
                                  </div>
                                ) : (
                                  <div className="mt-3 p-3 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p className="text-[11px] text-gray-500">Audio wird noch verarbeitet...</p>
                                  </div>
                                )}
                                
                                {/* Transcript */}
                                {call.transcript && (
                                  <div className="mt-3">
                                    <div className="text-[11px] font-medium mb-2" style={{ color: CI.goldLight }}>Transkript</div>
                                    <div 
                                      className="text-[12px] text-gray-300 leading-relaxed p-3 rounded-lg overflow-y-auto"
                                      style={{ 
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        maxHeight: '400px'
                                      }}
                                    >
                                      <pre className="whitespace-pre-wrap font-sans">
                                        {(() => {
                                          // Handle transcript that might be string or array
                                          if (typeof call.transcript === 'string') {
                                            // Already cleaned by backend
                                            return call.transcript;
                                          } else if (Array.isArray(call.transcript)) {
                                            // Parse array format (fallback if backend didn't clean)
                                            return call.transcript
                                              .filter((turn: any) => turn.message && turn.message.trim() !== '...')
                                              .map((turn: any) => {
                                                const role = turn.role === 'agent' ? 'ARAS AI' : 'Kunde';
                                                const message = turn.original_message || turn.message;
                                                return `${role}: ${message.trim()}`;
                                              })
                                              .join('\n\n');
                                          } else {
                                            return JSON.stringify(call.transcript, null, 2);
                                          }
                                        })()}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Purpose/Message */}
                                {(call.customPrompt || call.metadata?.purpose) && (
                                  <div className="mt-3">
                                    <div className="text-[11px] font-medium mb-1" style={{ color: CI.goldLight }}>Auftrag</div>
                                    <p className="text-[12px] text-gray-400 leading-relaxed">
                                      {call.customPrompt || call.metadata?.purpose}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                            </div>
                            
                            {callHistory.length > 10 && (
                              <div className="mt-4 text-center">
                                <span className="text-[11px] text-gray-500">
                                  Zeige die letzten 10 von {callHistory.length} Anrufen
                                </span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* RIGHT: Call History & Audio Playback */}
              <motion.div
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div
                  className="relative rounded-2xl p-7"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3
                        className="text-xl font-bold"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange})`,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        Anrufverlauf
                      </h3>
                      <div className="text-xs text-gray-400">
                        {callHistory.length} {callHistory.length === 1 ? 'Anruf' : 'Anrufe'}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Ihre letzten ausgeführten Anrufe</p>
                  </div>

                  {/* Call List */}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto premium-scroll">
                    {callHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${CI.orange}15, ${CI.goldLight}10)`,
                            border: `1px solid ${CI.orange}30`
                          }}
                        >
                          <Phone className="w-7 h-7 text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-400">Noch keine Anrufe getätigt</p>
                        <p className="text-xs text-gray-500 mt-1">Starten Sie Ihren ersten Anruf!</p>
                      </div>
                    ) : (
                      callHistory.map((call, idx) => (
                        <motion.div
                          key={call.id || idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="rounded-xl p-4 cursor-pointer transition-all"
                          style={{
                            background: expandedCall === call.id ? 'rgba(254, 145, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${expandedCall === call.id ? 'rgba(254, 145, 0, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                          onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                          onMouseEnter={(e) => {
                            if (expandedCall !== call.id) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (expandedCall !== call.id) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            }
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-white truncate">{call.contactName || 'Unbekannt'}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  call.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                  call.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {call.status === 'completed' ? 'Abgeschlossen' :
                                   call.status === 'failed' ? 'Fehlgeschlagen' :
                                   'Ausstehend'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 truncate">{call.phoneNumber}</div>
                              {call.createdAt && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true, locale: de })}
                                </div>
                              )}
                            </div>
                            <motion.div
                              animate={{ rotate: expandedCall === call.id ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </motion.div>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {expandedCall === call.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-4 pt-4 border-t border-gray-700/50 space-y-3"
                              >
                                {call.message && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Nachricht:</div>
                                    <div className="text-sm text-gray-300 leading-relaxed">{call.message}</div>
                                  </div>
                                )}
                                
                                {call.duration && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Dauer:</div>
                                    <div className="text-sm text-gray-300">{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')} Min</div>
                                  </div>
                                )}

                                {/* Audio Player Placeholder */}
                                {call.recordingUrl && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-2">Aufnahme:</div>
                                    <audio 
                                      controls 
                                      className="w-full"
                                      style={{
                                        height: '32px',
                                        borderRadius: '8px'
                                      }}
                                    >
                                      <source src={call.recordingUrl} type="audio/mpeg" />
                                      Ihr Browser unterstützt keine Audio-Wiedergabe.
                                    </audio>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Fonts & Scrollbar */}
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        .premium-scroll::-webkit-scrollbar { width: 6px; }
        .premium-scroll::-webkit-scrollbar-track { background: transparent; }
        .premium-scroll::-webkit-scrollbar-thumb { background: rgba(254,145,0,0.28); border-radius: 10px; }
        .premium-scroll::-webkit-scrollbar-thumb:hover { background: rgba(254,145,0,0.45); }
      `}</style>

      {/* 📱 KONTAKTBUCH PICKER MODAL */}
      <AnimatePresence>
        {showContactPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowContactPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-2xl rounded-2xl p-6 relative"
              style={{
                background: 'rgba(10, 10, 10, 0.98)',
                border: `1px solid ${CI.orange}30`,
                backdropFilter: 'blur(20px)',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold" style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Kontakt wählen
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{contacts.length} Kontakte verfügbar</p>
                </div>
                <button
                  onClick={() => setShowContactPicker(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Search */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder="Suchen..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              </div>

              {/* Contact List */}
              <div className="space-y-2">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <Contact className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                    <p className="text-sm text-gray-500">Keine Kontakte gefunden</p>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <motion.div
                      key={contact.id}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className="p-3 rounded-lg cursor-pointer transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                      onClick={() => handleSelectContact(contact)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `${CI.orange}15`,
                            border: `1px solid ${CI.orange}30`
                          }}
                        >
                          <Building2 className="w-5 h-5" style={{ color: CI.orange }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm mb-0.5">{contact.company}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            {(contact.firstName || contact.lastName) && (
                              <span>{[contact.firstName, contact.lastName].filter(Boolean).join(' ')}</span>
                            )}
                            {contact.phone && <span>{contact.phone}</span>}
                            {contact.email && <span className="truncate max-w-[150px]">{contact.email}</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ➕ NEUER KONTAKT MODAL */}
      <AnimatePresence>
        {showNewContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowNewContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-2xl rounded-2xl p-6 relative"
              style={{
                background: 'rgba(10, 10, 10, 0.98)',
                border: `1px solid ${CI.orange}30`,
                backdropFilter: 'blur(20px)',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold" style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldDark})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Neuer Kontakt
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Alle Felder ausfüllen und speichern</p>
                </div>
                <button
                  onClick={() => setShowNewContactModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Company - Required */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" style={{ color: CI.orange }} />
                    Firma <span style={{ color: CI.orange }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newContactData.company}
                    onChange={(e) => setNewContactData({ ...newContactData, company: e.target.value })}
                    placeholder="Firmenname eingeben"
                    className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  />
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" style={{ color: CI.goldLight }} />
                      Vorname
                    </label>
                    <input
                      type="text"
                      value={newContactData.firstName}
                      onChange={(e) => setNewContactData({ ...newContactData, firstName: e.target.value })}
                      placeholder="Vorname"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" style={{ color: CI.goldLight }} />
                      Nachname
                    </label>
                    <input
                      type="text"
                      value={newContactData.lastName}
                      onChange={(e) => setNewContactData({ ...newContactData, lastName: e.target.value })}
                      placeholder="Nachname"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                </div>

                {/* Contact Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" style={{ color: CI.orange }} />
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={newContactData.phone}
                      onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                      placeholder="+49..."
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" style={{ color: CI.goldLight }} />
                      E-Mail
                    </label>
                    <input
                      type="email"
                      value={newContactData.email}
                      onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                      placeholder="email@beispiel.de"
                      className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5" style={{ color: CI.goldLight }} />
                    Notizen
                  </label>
                  <textarea
                    value={newContactData.notes}
                    onChange={(e) => setNewContactData({ ...newContactData, notes: e.target.value })}
                    placeholder="Zusätzliche Informationen..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all resize-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveNewContact}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                      color: '#000'
                    }}
                  >
                    Kontakt speichern
                  </button>
                  <button
                    onClick={() => {
                      setNewContactData({
                        company: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        email: '',
                        notes: ''
                      });
                      setShowNewContactModal(false);
                    }}
                    className="px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#9ca3af'
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔥 CLARIFICATION CHAT MODAL */}
      <AnimatePresence>
        {showChatFlow && validationResult?.questions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: 'rgba(10, 10, 10, 0.92)',
              backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl w-full"
            >
              <ClarificationChat
                questions={validationResult.questions}
                onAnswersComplete={handleChatComplete}
                onSkip={handleSkipChat}
                initialMessage={message}
                userProfileContext={userProfileContext || null}
                callStatus={callStatus}
                finalSummary={callSummary}
                callInProgressSummaryHint="Der Anruf läuft – ich höre zu und bereite deine Zusammenfassung vor."
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔥 REVIEW MODAL */}
      <AnimatePresence>
        {showReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: 'rgba(10, 10, 10, 0.90)',
              backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full p-8 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
                border: '1px solid rgba(254,145,0,0.3)',
                boxShadow: '0 20px 60px rgba(254,145,0,0.2)'
              }}
            >
              <button
                onClick={() => setShowReview(false)}
                className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    boxShadow: `0 0 30px rgba(254,145,0,0.4)`
                  }}
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 
                  className="text-2xl font-black mb-2"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  Anruf-Review
                </h2>
                <p className="text-sm text-gray-400">Prüfen Sie die Details vor dem Start</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl" style={{
                  background: 'rgba(254,145,0,0.08)',
                  border: '1px solid rgba(254,145,0,0.2)'
                }}>
                  <div className="text-xs text-gray-400 mb-1">Kontakt</div>
                  <div className="text-lg font-semibold text-white">{contactName}</div>
                  <div className="text-sm text-gray-300">{phoneNumber}</div>
                </div>

                <div className="p-4 rounded-xl" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div className="text-xs text-gray-400 mb-2">ARAS wird folgendes tun:</div>
                  <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {enhancedPrompt}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReview(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff'
                  }}
                >
                  Zurück
                </button>
                <button
                  onClick={handleConfirmCall}
                  disabled={loading}
                  className="flex-1 px-6 py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] relative overflow-hidden group"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#fff',
                    fontFamily: 'Orbitron, sans-serif',
                    boxShadow: `0 8px 24px rgba(254,145,0,0.3)`
                  }}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 inline animate-spin mr-2" />Starte...</>
                  ) : (
                    <>🚀 Jetzt anrufen</>
                  )}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)'
                    }}
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
