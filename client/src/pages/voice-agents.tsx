import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Loader2, CheckCircle2, XCircle, MessageSquare, Clock, User, FileText, Sparkles, Zap, ChevronDown, ChevronUp } from "lucide-react";
import type { SubscriptionResponse } from "@shared/schema";

const EXAMPLE_PROMPTS = [
  "Erinnere an den Termin morgen um 10 Uhr",
  "Bestätige die Buchung und gib die Referenznummer durch",
  "Frag ob noch Interesse am Angebot besteht",
  "Informiere über die neue Produktlinie",
  "Vereinbare einen Rückruftermin für nächste Woche",
  "Bestätige den Liefertermin für Freitag",
  "Erinnere an die ausstehende Rechnung",
  "Frag nach Feedback zum letzten Service",
  "Teile mit dass das Meeting verschoben wurde",
  "Informiere über die Sonderaktion diese Woche",
  "Bestätige die Tischreservierung für heute Abend",
  "Erinnere an den Zahnarzttermin übermorgen",
  "Frag ob die Bestellung angekommen ist",
  "Teile die neue Öffnungszeit mit",
  "Bestätige die Anmeldung zum Workshop",
  "Erinnere an die Vertragsverlängerung",
  "Frag nach dem bevorzugten Lieferdatum",
  "Informiere über die Statusänderung",
  "Bestätige den Abholtermin",
  "Erinnere an das anstehende Event",
  "Frag ob weitere Fragen bestehen",
  "Teile mit dass die Bearbeitung abgeschlossen ist",
  "Bestätige die Teilnahme am Webinar",
  "Erinnere an die Verlängerung der Mitgliedschaft",
  "Frag nach der Zufriedenheit mit dem Produkt"
];

const PHONE_EXAMPLES = [
  "+4917631118560",
  "+4915234567890",
  "+4916812345678",
  "+4917798765432",
  "+4915587654321"
];

export default function VoiceAgents() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState(false);
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [currentPhoneExample, setCurrentPhoneExample] = useState(0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const { data: userSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
    retry: false,
  });

  const subscriptionData: SubscriptionResponse = userSubscription || {
    plan: 'free',
    status: 'active',
    aiMessagesUsed: 0,
    voiceCallsUsed: 0,
    aiMessagesLimit: 10,
    voiceCallsLimit: 2,
    renewalDate: null,
    hasPaymentMethod: false,
    requiresPaymentSetup: false,
    isTrialActive: false,
    canUpgrade: true
  };

  const handleSectionChange = (section: string) => {
    if (section !== "voice-agents") {
      window.location.href = `/${section}`;
    }
  };

  // Cycle through example prompts
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExampleIndex((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Cycle through phone examples
  useEffect(() => {
    if (phoneNumber) return;
    
    const interval = setInterval(() => {
      setCurrentPhoneExample((prev) => (prev + 1) % PHONE_EXAMPLES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [phoneNumber]);

  const fetchTranscript = async (callId: string, attempt = 1) => {
    if (attempt === 1) setLoadingTranscript(true);
    setTranscriptError(false);
    
    try {
      const response = await fetch(`/api/voice/calls/${callId}/transcript`);
      const data = await response.json();
      
      if (data.success && data.transcript) {
        setTranscript(data.transcript);
        setLoadingTranscript(false);
      } else if (attempt < 10) {
        setTimeout(() => fetchTranscript(callId, attempt + 1), 5000);
      } else {
        setTranscriptError(true);
        setLoadingTranscript(false);
      }
    } catch (error) {
      console.error('Failed to fetch transcript:', error);
      if (attempt < 10) {
        setTimeout(() => fetchTranscript(callId, attempt + 1), 5000);
      } else {
        setTranscriptError(true);
        setLoadingTranscript(false);
      }
    }
  };

  const makeCall = async () => {
    if (!phoneNumber) return;
    
    setLoading(true);
    setResult(null);
    setTranscript(null);
    setTranscriptError(false);
    setShowFullTranscript(false);
    
    try {
      if (customPrompt.trim()) {
        const taskRes = await fetch("/api/voice/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            taskName: "Quick Call",
            taskPrompt: customPrompt,
            phoneNumber 
          })
        });
        const taskData = await taskRes.json();
        
        const execRes = await fetch("/api/voice/tasks/" + taskData.task.id + "/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber, taskPrompt: customPrompt })
        });
        const data = await execRes.json();
        setResult(data);
        if (data.call && data.call.call_id) {
          fetchTranscript(data.call.call_id);
        }
      } else {
        const response = await fetch("/api/voice/retell/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber })
        });
        
        // Check for limit reached (403)
        if (!response.ok) {
          if (response.status === 403) {
            const errorData = await response.json();
            const errorMessage = errorData.error || errorData.message || "Voice call limit reached";
            
            setResult({ 
              success: false, 
              message: errorMessage,
              requiresUpgrade: errorData.requiresUpgrade
            });
            
            // Show prominent error message
            toast({
              title: "Voice Call Limit erreicht! 📞❌",
              description: errorMessage,
              variant: "destructive",
              duration: 15000,
              action: errorData.requiresUpgrade ? (
                <ToastAction 
                  altText="Jetzt upgraden" 
                  onClick={() => window.location.href = '/billing'}
                >
                  Jetzt upgraden 🚀
                </ToastAction>
              ) : undefined
            });
            
            // Refresh usage data to show correct limits
            queryClient.invalidateQueries({ queryKey: ["/api/user/usage"] });
            return;
          }
          
          const data = await response.json();
          setResult({ success: false, message: data.message || "Call failed" });
          return;
        }
        
        const data = await response.json();
        setResult(data);
        if (data.call && data.call.call_id) {
          fetchTranscript(data.call.call_id);
        }
        
        // Refresh usage data after successful call
        queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/usage"] });
      }
    } catch (error) {
      setResult({ success: false, message: "Call failed" });
    } finally {
      setLoading(false);
    }
  };

  const truncateTranscript = (text: string, maxLength: number = 1000) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        activeSection="voice-agents" 
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col relative content-zoom">
        <TopBar 
          currentSection="voice-agents" 
          subscriptionData={subscriptionData}
          user={user as import("@shared/schema").User}
          isVisible={true}
        />
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Hero Header */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-block"
              >
                <h1 className="text-5xl font-bold mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <span className="bg-gradient-to-r from-[#FE9100] via-white to-[#FE9100] bg-clip-text text-transparent">
                    ARAS AI CALL
                  </span>
                </h1>
              </motion.div>
              <p className="text-gray-400 flex items-center justify-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-[#FE9100]" />
                KI-gesteuerte Anrufe in Sekunden
              </p>
            </motion.div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Call Form */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.2 }}
              >
                <div className="relative group">
                  <div className="absolute -inset-[2px] bg-gradient-to-r from-[#FE9100] via-[#a34e00] to-[#FE9100] rounded-2xl opacity-0 group-hover:opacity-100 blur transition-opacity duration-500" />
                  <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <motion.div 
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FE9100]/20 to-[#a34e00]/20 flex items-center justify-center ring-2 ring-[#FE9100]/30"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <Phone className="w-6 h-6 text-[#FE9100]" />
                      </motion.div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Neuer Anruf</h2>
                        <p className="text-sm text-gray-400">ARAS ruft für dich an</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Phone Number Input - FIXED CENTERING */}
                      <div>
                        <label className="block text-sm font-medium mb-3 text-gray-300 flex items-center gap-2">
                          <User className="w-4 h-4 text-[#FE9100]" />
                          Telefonnummer
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-5 py-4 bg-black/50 border border-white/10 rounded-xl focus:border-[#FE9100] focus:ring-2 focus:ring-[#FE9100]/20 focus:outline-none transition-all text-white text-lg"
                          />
                          
                          {/* FIXED: Properly Centered Animated Placeholder */}
                          <AnimatePresence mode="wait">
                            {!phoneNumber && (
                              <motion.div
                                key={currentPhoneExample}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0 flex items-center px-5 pointer-events-none text-gray-500 text-lg"
                              >
                                {PHONE_EXAMPLES[currentPhoneExample]}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          
                          {phoneNumber && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute right-4 top-1/2 -translate-y-1/2"
                            >
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Custom Prompt */}
                      <div>
                        <label className="block text-sm font-medium mb-3 text-gray-300 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[#FE9100]" />
                          Was soll ARAS sagen? (Optional)
                        </label>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="z.B. Bestätige den Termin für morgen..."
                          rows={4}
                          className="w-full px-5 py-4 bg-black/50 border border-white/10 rounded-xl focus:border-[#FE9100] focus:ring-2 focus:ring-[#FE9100]/20 focus:outline-none transition-all resize-none text-white"
                        />
                      </div>

                      {/* Call Button */}
                      <motion.button
                        onClick={makeCall}
                        disabled={loading || !phoneNumber}
                        whileHover={{ scale: !loading && phoneNumber ? 1.02 : 1 }}
                        whileTap={{ scale: !loading && phoneNumber ? 0.98 : 1 }}
                        className="w-full relative group"
                      >
                        <div className="absolute -inset-[2px] bg-gradient-to-r from-[#FE9100] to-[#a34e00] rounded-xl opacity-75 group-hover:opacity-100 blur-md transition-all" />
                        <div className={`relative py-5 bg-gradient-to-r from-[#FE9100] to-[#a34e00] rounded-xl font-bold text-xl text-white flex items-center justify-center gap-3 transition-all ${
                          loading || !phoneNumber ? 'opacity-50 cursor-not-allowed' : ''
                        }`}>
                          {loading ? (
                            <>
                              <Loader2 className="w-7 h-7 animate-spin" />
                              <span>Anruf läuft...</span>
                            </>
                          ) : (
                            <>
                              <Phone className="w-7 h-7" />
                              <span>Jetzt anrufen</span>
                            </>
                          )}
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* CLICKABLE Animated Examples Card with 20+ Examples */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.3 }}
                  className="mt-6 relative"
                >
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-[#FE9100]/20 to-[#a34e00]/20 rounded-xl blur" />
                  <div className="relative p-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl">
                    <h3 className="font-semibold mb-4 text-[#FE9100] flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4" />
                      Beispiel-Anweisungen (klicken zum Übernehmen)
                    </h3>
                    
                    {/* Clickable Animated Example */}
                    <AnimatePresence mode="wait">
                      <motion.button
                        key={currentExampleIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                        onClick={() => setCustomPrompt(EXAMPLE_PROMPTS[currentExampleIndex])}
                        className="w-full text-left flex items-start gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-[#FE9100]/30 transition-all group cursor-pointer"
                      >
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="flex-shrink-0 mt-0.5"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#FE9100] group-hover:shadow-lg group-hover:shadow-[#FE9100]/50" />
                        </motion.div>
                        <p className="text-sm text-gray-300 group-hover:text-white leading-relaxed transition-colors">
                          "{EXAMPLE_PROMPTS[currentExampleIndex]}"
                        </p>
                      </motion.button>
                    </AnimatePresence>

                    {/* Progress Dots */}
                    <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
                      {Array.from({ length: Math.min(EXAMPLE_PROMPTS.length, 12) }).map((_, index) => (
                        <motion.div
                          key={index}
                          className={`h-1 rounded-full transition-all ${
                            index === currentExampleIndex % 12
                              ? 'w-8 bg-[#FE9100]' 
                              : 'w-1 bg-gray-600'
                          }`}
                          animate={{
                            scale: index === currentExampleIndex % 12 ? [1, 1.2, 1] : 1
                          }}
                          transition={{ duration: 0.3 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right: Results */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                <AnimatePresence mode="wait">
                  {result ? (
                    <>
                      {/* Call Status */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative group"
                      >
                        <div className={`absolute -inset-[2px] rounded-2xl blur transition-all ${
                          result.success ? 'bg-gradient-to-r from-green-500 to-emerald-500 opacity-50 group-hover:opacity-75' : 'bg-gradient-to-r from-red-500 to-pink-500 opacity-50'
                        }`} />
                        <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                          <div className="flex items-center gap-4 mb-6">
                            <motion.div 
                              className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                                result.success ? 'bg-green-500/20 ring-2 ring-green-500/30' : 'bg-red-500/20 ring-2 ring-red-500/30'
                              }`}
                              animate={{ scale: result.success ? [1, 1.05, 1] : 1 }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              {result.success ? 
                                <CheckCircle2 className="w-7 h-7 text-green-400" /> : 
                                <XCircle className="w-7 h-7 text-red-400" />
                              }
                            </motion.div>
                            <div>
                              <h3 className="text-2xl font-bold text-white">
                                {result.success ? "Anruf aktiv!" : "Fehler"}
                              </h3>
                              <p className="text-gray-400">
                                {result.success ? "ARAS AI ist verbunden" : "Versuch es erneut"}
                              </p>
                            </div>
                          </div>
                          
                          {result.call && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/5">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400 mb-1">Call ID</p>
                                  <p className="text-sm text-white font-mono truncate">{result.call.call_id}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/5">
                                <Clock className="w-5 h-5 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Status</p>
                                  <p className="text-sm text-green-400 font-semibold">{result.call.call_status}</p>
                                </div>
                              </div>
                              {customPrompt && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 p-4 bg-[#FE9100]/10 border border-[#FE9100]/30 rounded-lg"
                                >
                                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Anweisung
                                  </p>
                                  <p className="text-sm text-white leading-relaxed">{customPrompt}</p>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>

                      {/* Transcript with Expand/Collapse for Long Transcripts */}
                      {result.success && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="relative group"
                        >
                          <div className="absolute -inset-[2px] bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-30 group-hover:opacity-50 blur transition-opacity" />
                          <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center ring-2 ring-purple-500/30">
                                <FileText className="w-6 h-6 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white">Transkript</h3>
                                <p className="text-sm text-gray-400">Live-Konversation</p>
                              </div>
                            </div>

                            <div className="min-h-[250px]">
                              {loadingTranscript && !transcript && (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  >
                                    <Loader2 className="w-10 h-10 text-[#FE9100] mb-4" />
                                  </motion.div>
                                  <p className="text-sm font-medium">Transkript wird erstellt...</p>
                                  <p className="text-xs text-gray-500 mt-2">Bis zu 50 Sekunden</p>
                                </div>
                              )}

                              {transcript && (
                                <div>
                                  <motion.div 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }}
                                    className="p-5 bg-white/5 rounded-xl border border-white/5 custom-scrollbar"
                                    style={{ 
                                      maxHeight: showFullTranscript ? 'none' : '300px',
                                      overflow: showFullTranscript ? 'visible' : 'hidden'
                                    }}
                                  >
                                    <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                      {showFullTranscript ? transcript : truncateTranscript(transcript)}
                                    </pre>
                                  </motion.div>
                                  
                                  {/* Show More/Less Button for Long Transcripts */}
                                  {transcript.length > 1000 && (
                                    <motion.button
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      onClick={() => setShowFullTranscript(!showFullTranscript)}
                                      className="mt-3 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2"
                                    >
                                      {showFullTranscript ? (
                                        <>
                                          <ChevronUp className="w-4 h-4" />
                                          Weniger anzeigen
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-4 h-4" />
                                          Vollständiges Transkript anzeigen ({transcript.length} Zeichen)
                                        </>
                                      )}
                                    </motion.button>
                                  )}
                                </div>
                              )}

                              {transcriptError && !transcript && (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                  <XCircle className="w-10 h-10 mb-4 text-red-500" />
                                  <p className="text-sm font-medium">Transkript nicht verfügbar</p>
                                  <p className="text-xs text-gray-500 mt-2">Call war zu kurz oder noch nicht fertig</p>
                                </div>
                              )}

                              {!loadingTranscript && !transcript && !transcriptError && (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                  <FileText className="w-10 h-10 mb-4 text-gray-600" />
                                  <p className="text-sm">Warte auf Transkript...</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center min-h-[500px]"
                    >
                      <motion.div
                        animate={{ 
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="w-24 h-24 rounded-full bg-[#FE9100]/20 flex items-center justify-center mb-6 ring-4 ring-[#FE9100]/10"
                      >
                        <Phone className="w-12 h-12 text-[#FE9100]" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white mb-3">Bereit für deinen Call?</h3>
                      <p className="text-gray-400 max-w-sm">
                        Gib eine Telefonnummer ein und starte einen KI-gesteuerten Anruf
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(254, 145, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(254, 145, 0, 0.5);
        }
      `}</style>
    </div>
  );
}
