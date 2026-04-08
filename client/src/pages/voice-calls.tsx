import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Loader2, CheckCircle2, XCircle, MessageSquare, Clock, User, Sparkles, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function VoiceCalls() {
  const { toast } = useToast();
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const makeCall = async () => {
    if (!phoneNumber || !contactName || !message) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch("/api/aras-voice/smart-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: contactName,
          phoneNumber,
          message
        })
      });
      
      // Check for limit reached (403)
      if (!response.ok && response.status === 403) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || "Voice call limit reached";
        
        setResult({ 
          success: false, 
          error: errorMessage
        });
        
        // Show prominent error toast with upgrade button
        toast({
          title: "Anruf-Limit erreicht! 📞❌",
          description: errorMessage,
          variant: "destructive",
          duration: 15000,
          action: (
            <ToastAction 
              altText="Jetzt upgraden" 
              onClick={() => window.location.href = '/billing'}
            >
              Jetzt upgraden 🚀
            </ToastAction>
          )
        });
        
        return;
      }
      
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ 
        success: false, 
        error: error.message || "Anruf fehlgeschlagen" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#fe9100] to-orange-600 flex items-center justify-center shadow-lg shadow-[#fe9100]/20">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                ARAS Neural Voice
              </h1>
              <p className="text-gray-400 flex items-center gap-2 mt-1">
                <BrainCircuit className="w-4 h-4 text-[#fe9100]" />
                Ultra-menschliche KI-Anrufe
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-gray-800/50 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#fe9100]/20 flex items-center justify-center ring-2 ring-[#fe9100]/30">
                  <Phone className="w-6 h-6 text-[#fe9100]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Smart Call</h2>
                  <p className="text-sm text-gray-400">ARAS AI Neural Voice System</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#fe9100]" />
                    Kontaktname *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="z.B. Restaurant Bella Italia"
                    className="w-full px-4 py-3.5 bg-black/50 border border-gray-700/50 rounded-xl focus:border-[#fe9100] focus:ring-2 focus:ring-[#fe9100]/20 focus:outline-none transition-all text-lg text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#fe9100]" />
                    Telefonnummer *
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+49 176 611 19320"
                    className="w-full px-4 py-3.5 bg-black/50 border border-gray-700/50 rounded-xl focus:border-[#fe9100] focus:ring-2 focus:ring-[#fe9100]/20 focus:outline-none transition-all text-lg text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#fe9100]" />
                    Was soll ARAS AI sagen? *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="z.B. Verschiebe meine Reservierung auf morgen 18:00 Uhr"
                    rows={4}
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700/50 rounded-xl focus:border-[#fe9100] focus:ring-2 focus:ring-[#fe9100]/20 focus:outline-none transition-all resize-none text-white placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                    <BrainCircuit className="w-3 h-3" />
                    ARAS AI analysiert deine Nachricht und erstellt einen perfekt menschlichen Anruf
                  </p>
                </div>

                <button
                  onClick={makeCall}
                  disabled={loading || !phoneNumber || !contactName || !message}
                  className="w-full py-4 bg-gradient-to-r from-[#fe9100] to-orange-600 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-[#fe9100]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-white hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>ARAS AI ruft an...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-6 h-6" />
                      <span>Jetzt anrufen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 p-6 bg-gradient-to-br from-gray-900/50 to-gray-950/50 backdrop-blur-xl border border-gray-800/50 rounded-2xl">
              <h3 className="font-semibold mb-3 text-[#fe9100] flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" />
                Beispiele
              </h3>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[#fe9100] mt-0.5">•</span><span>"Erinnere an den Termin morgen um 10 Uhr"</span></li>
                <li className="flex items-start gap-2"><span className="text-[#fe9100] mt-0.5">•</span><span>"Verschiebe meine Reservierung auf Freitag 19:00 Uhr"</span></li>
                <li className="flex items-start gap-2"><span className="text-[#fe9100] mt-0.5">•</span><span>"Frage ob sie noch Interesse am Angebot haben"</span></li>
                <li className="flex items-start gap-2"><span className="text-[#fe9100] mt-0.5">•</span><span>"Bestätige die Buchung mit Referenznummer"</span></li>
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <p className="text-xs text-gray-500 flex items-start gap-2">
                  <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>ARAS AI nutzt intelligente Kontext-Analyse um jeden Anruf perfekt menschlich zu gestalten</span>
                </p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-gray-800/50 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${result.success ? 'bg-green-500/20 ring-2 ring-green-500/30' : 'bg-red-500/20 ring-2 ring-red-500/30'}`}>
                      {result.success ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{result.success ? "Anruf gestartet!" : "Fehler"}</h3>
                      <p className="text-sm text-gray-400">Call Details</p>
                    </div>
                  </div>
                  
                  {result.callId && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400">Call ID</p>
                          <p className="text-sm text-white font-mono truncate">{result.callId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">Status</p>
                          <p className="text-sm text-green-500 font-medium">{result.status || 'initiated'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                        <BrainCircuit className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">System</p>
                          <p className="text-sm text-[#fe9100] font-medium">ARAS Neural Voice</p>
                        </div>
                      </div>
                      {result.message && (
                        <div className="mt-4 p-4 bg-gradient-to-br from-[#fe9100]/10 to-orange-600/10 border border-[#fe9100]/30 rounded-xl">
                          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" />
                            System Response
                          </p>
                          <p className="text-sm text-white leading-relaxed">{result.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400 text-sm">{result.error}</p>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}