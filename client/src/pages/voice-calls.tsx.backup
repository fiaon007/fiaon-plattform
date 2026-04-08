import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Loader2, CheckCircle2, XCircle, MessageSquare } from "lucide-react";

export default function VoiceCalls() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const makeCall = async () => {
    if (!phoneNumber) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      // Wenn Custom Prompt, nutze Task System
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
        
        // Execute Task
        const execRes = await fetch(`/api/voice/tasks/${taskData.task.id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber, taskPrompt: customPrompt })
        });
        const data = await execRes.json();
        setResult(data);
      } else {
        // Standard Anruf
        const response = await fetch("/api/voice/retell/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber })
        });
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      setResult({ success: false, message: "Call failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#fe9100] to-orange-600 bg-clip-text text-transparent">
            ARAS Voice AI
          </h1>
          <p className="text-gray-400">Powered by Retell AI</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#fe9100]/20 flex items-center justify-center">
              <Phone className="w-6 h-6 text-[#fe9100]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Anruf starten</h2>
              <p className="text-sm text-gray-400">ARAS ruft deine Nummer an</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Telefonnummer *</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+41 44 505 4333"
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl focus:border-[#fe9100] focus:outline-none transition-colors text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#fe9100]" />
                Was soll ARAS sagen? (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Beispiel: 'Sag der Person, dass das Meeting auf morgen 15 Uhr verschoben wird. Frag ob das passt.'"
                rows={4}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl focus:border-[#fe9100] focus:outline-none transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Lass das Feld leer für einen Standard-Anruf oder gib ARAS spezifische Anweisungen
              </p>
            </div>

            <button
              onClick={makeCall}
              disabled={loading || !phoneNumber}
              className="w-full py-4 bg-gradient-to-r from-[#fe9100] to-orange-600 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-[#fe9100]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Rufe an...
                </>
              ) : (
                <>
                  <Phone className="w-6 h-6" />
                  {customPrompt ? "Mit Custom Prompt anrufen" : "Jetzt anrufen"}
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <h3 className="text-xl font-bold">
                {result.success ? "Anruf gestartet!" : "Fehler"}
              </h3>
            </div>
            
            {result.call && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">Call ID: <span className="text-white font-mono">{result.call.call_id}</span></p>
                <p className="text-gray-400">Status: <span className="text-green-500">{result.call.call_status}</span></p>
                <p className="text-gray-400">Agent: <span className="text-[#fe9100]">ARAS AI</span></p>
                {customPrompt && (
                  <div className="mt-4 p-4 bg-[#fe9100]/10 border border-[#fe9100]/30 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Custom Prompt:</p>
                    <p className="text-sm text-white">{customPrompt}</p>
                  </div>
                )}
              </div>
            )}
            
            {result.message && !result.success && (
              <p className="text-red-400">{result.message}</p>
            )}
          </motion.div>
        )}

        <div className="mt-6 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h3 className="font-semibold mb-2 text-[#fe9100]">💡 Beispiele für Custom Prompts:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• "Erinnere an den Termin morgen um 10 Uhr"</li>
            <li>• "Sag dass das Essen verschoben wird auf Freitag 19 Uhr"</li>
            <li>• "Frag ob die Person noch Interesse am Angebot hat"</li>
            <li>• "Bestätige die Buchung und gib die Referenznummer durch"</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
