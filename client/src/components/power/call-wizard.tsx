import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Settings, Sparkles, Phone, ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  question: string;
  type: 'text' | 'date' | 'time' | 'choice';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

interface CallWizardProps {
  contactName: string;
  phoneNumber: string;
  initialMessage: string;
  onCallReady: (enhancedData: any) => void;
  onCancel: () => void;
}

const CI = {
  orange: '#FE9100',
  goldLight: '#E9D7C4',
  goldDark: '#A34E00'
};

export function CallWizard({ 
  contactName, 
  phoneNumber, 
  initialMessage, 
  onCallReady,
  onCancel 
}: CallWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'validating' | 'questions' | 'settings' | 'review'>('validating');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState({
    tone: 'freundlich',
    urgency: 'mittel',
    maxDuration: 180
  });
  const [finalPrompt, setFinalPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    validatePrompt();
  }, []);

  const validatePrompt = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/aras-voice/validate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: initialMessage,
          contactName,
          answers
        })
      });

      if (!response.ok) {
        throw new Error('Validierung fehlgeschlagen');
      }

      const result = await response.json();
      setValidationResult(result);

      if (result.isComplete) {
        setFinalPrompt(result.enhancedPrompt);
        setSettings(result.suggestedSettings || settings);
        setStep('settings');
      } else {
        setStep('questions');
      }
    } catch (error: any) {
      toast({
        title: 'Validierung fehlgeschlagen',
        description: error.message,
        variant: 'destructive'
      });
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/aras-voice/validate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: initialMessage,
          contactName,
          answers
        })
      });

      if (!response.ok) {
        throw new Error('Validierung fehlgeschlagen');
      }

      const result = await response.json();
      
      // 🔥 WICHTIG: Wenn User alle REQUIRED Fragen beantwortet hat, weitergehen!
      // Gemini will oft mehr Details, aber das ist optional
      const allRequiredAnswered = result.questions
        ?.filter((q: Question) => q.required)
        .every((q: Question) => answers[q.id]?.trim());
      
      if (result.isComplete || allRequiredAnswered) {
        // Nutze enhanced prompt wenn vorhanden, sonst original message + answers
        const enhancedPrompt = result.enhancedPrompt || 
          `${initialMessage}\n\nZusätzliche Details:\n${Object.entries(answers)
            .map(([key, value]) => `- ${result.questions?.find((q: any) => q.id === key)?.question || key}: ${value}`)
            .join('\n')}`;
        
        setFinalPrompt(enhancedPrompt);
        setSettings(result.suggestedSettings || settings);
        
        toast({
          title: '✅ Bereit für Anruf',
          description: result.isComplete 
            ? 'Alle Informationen vollständig!'
            : 'Alle Pflichtfragen beantwortet. Anruf kann gestartet werden.'
        });
        
        setStep('settings');
      } else {
        toast({
          title: 'Weitere Informationen benötigt',
          description: 'Bitte beantworten Sie alle erforderlichen Fragen',
          variant: 'destructive'
        });
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

  const handleSettingsComplete = () => {
    setStep('review');
  };

  const handleStartCall = () => {
    onCallReady({
      enhancedPrompt: finalPrompt,
      settings,
      answers,
      contactName,
      phoneNumber
    });
  };

  if (step === 'validating' || loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative p-12 max-w-md w-full text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(233, 215, 196, 0.05))',
            border: '1px solid rgba(254, 145, 0, 0.2)',
            borderRadius: '24px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(254, 145, 0, 0.15)'
          }}
        >
          {/* Animated Glow */}
          <div className="absolute inset-0 rounded-3xl opacity-30 animate-pulse"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(254, 145, 0, 0.2), transparent 70%)'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Simple Loading Circle */}
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-full h-full rounded-full"
                style={{
                  border: `3px solid rgba(254, 145, 0, 0.2)`,
                  borderTopColor: CI.orange,
                  boxShadow: `0 0 20px ${CI.orange}30`
                }}
              />
            </div>
            
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-white mb-3"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Analysiere Anfrage...
            </motion.h3>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-300 text-sm"
            >
              <span style={{ color: CI.orange, fontWeight: 600 }}>ARAS AI</span> prüft die Vollständigkeit
            </motion.p>
            
            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 1, 0.4]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: CI.orange }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (step === 'questions' && validationResult) {
    const allRequiredAnswered = validationResult.questions
      ?.filter((q: Question) => q.required)
      .every((q: Question) => answers[q.id]?.trim());

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        style={{
          background: 'rgba(10, 10, 10, 0.88)',
          backdropFilter: 'blur(14px)'
        }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative max-w-2xl w-full my-8"
          style={{
            background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.92), rgba(30, 30, 30, 0.85))',
            border: '1px solid rgba(254, 145, 0, 0.25)',
            borderRadius: '28px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(254, 145, 0, 0.1) inset'
          }}
        >
          {/* Header with Gradient Glow */}
          <div className="relative p-8 pb-6">
            <div className="absolute top-0 left-0 right-0 h-32 opacity-20"
              style={{
                background: 'radial-gradient(ellipse at top, rgba(254, 145, 0, 0.4), transparent 70%)',
                filter: 'blur(40px)'
              }}
            />
            
            <div className="relative flex items-start gap-4">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}20, ${CI.goldLight}15)`,
                  border: `1px solid ${CI.orange}40`
                }}
              >
                <AlertCircle className="w-7 h-7" style={{ color: CI.orange }} />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black text-white mb-2"
                  style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    background: `linear-gradient(90deg, #fff, ${CI.goldLight})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  Zusätzliche Details erforderlich
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-300 text-sm leading-relaxed"
                >
                  <span style={{ color: CI.orange, fontWeight: 600 }}>ARAS AI</span> benötigt weitere Informationen für einen professionellen Anruf
                  {validationResult.detectedIntent && (
                    <span className="block mt-1 text-xs text-gray-400">
                      Erkannt: <span style={{ color: CI.goldLight }}>{validationResult.detectedIntent}</span>
                    </span>
                  )}
                </motion.p>
              </div>
              
              <button
                onClick={onCancel}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all hover:scale-105"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Missing Info Badge */}
          {validationResult.missingInfo && validationResult.missingInfo.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mx-8 mb-6 p-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(255, 100, 100, 0.05))',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" style={{ color: CI.orange }} />
                <h4 className="text-sm font-bold text-white">Noch zu klären:</h4>
              </div>
              <ul className="space-y-1.5 pl-6">
                {validationResult.missingInfo.map((info: string, idx: number) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + (idx * 0.1) }}
                    className="text-sm text-gray-300"
                  >
                    • {info}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Questions Form */}
          <div className="px-8 space-y-6 mb-8">
            {validationResult.questions?.map((question: Question, idx: number) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + (idx * 0.1) }}
                className="space-y-2"
              >
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}25, ${CI.goldLight}15)`,
                      color: CI.orange
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{question.question}</span>
                  {question.required && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      Pflichtfeld
                    </span>
                  )}
                </label>

                {question.type === 'text' && (
                  <input
                    type="text"
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    placeholder={question.placeholder || 'Ihre Antwort...'}
                    className="w-full px-5 py-3.5 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${answers[question.id] ? CI.orange + '60' : 'rgba(255, 255, 255, 0.1)'}`,
                      boxShadow: answers[question.id] ? `0 0 0 3px ${CI.orange}15` : 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = CI.orange + '80';
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${CI.orange}20`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = answers[question.id] ? CI.orange + '60' : 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.boxShadow = answers[question.id] ? `0 0 0 3px ${CI.orange}15` : 'none';
                    }}
                  />
                )}

                {question.type === 'date' && (
                  <input
                    type="date"
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    className="w-full px-5 py-3.5 rounded-2xl text-white focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${answers[question.id] ? CI.orange + '60' : 'rgba(255, 255, 255, 0.1)'}`,
                      boxShadow: answers[question.id] ? `0 0 0 3px ${CI.orange}15` : 'none'
                    }}
                  />
                )}

                {question.type === 'time' && (
                  <input
                    type="time"
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    className="w-full px-5 py-3.5 rounded-2xl text-white focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${answers[question.id] ? CI.orange + '60' : 'rgba(255, 255, 255, 0.1)'}`,
                      boxShadow: answers[question.id] ? `0 0 0 3px ${CI.orange}15` : 'none'
                    }}
                  />
                )}

                {question.type === 'choice' && question.options && (
                  <select
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    className="w-full px-5 py-3.5 rounded-2xl text-white focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${answers[question.id] ? CI.orange + '60' : 'rgba(255, 255, 255, 0.1)'}`,
                      boxShadow: answers[question.id] ? `0 0 0 3px ${CI.orange}15` : 'none'
                    }}
                  >
                    <option value="" style={{ background: '#1a1a1a' }}>Bitte wählen...</option>
                    {question.options.map((opt) => (
                      <option key={opt} value={opt} style={{ background: '#1a1a1a' }}>{opt}</option>
                    ))}
                  </select>
                )}
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="px-8 pb-8 flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff'
              }}
            >
              Abbrechen
            </button>
            
            {/* Skip Button - Jetzt anrufen ohne alle Fragen */}
            <button
              onClick={() => {
                const enhancedPrompt = `${initialMessage}\n\nZusätzliche Details:\n${Object.entries(answers)
                  .map(([key, value]) => `- ${key}: ${value}`)
                  .join('\n')}`;
                setFinalPrompt(enhancedPrompt);
                setStep('settings');
              }}
              disabled={loading}
              className="px-6 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
              style={{
                background: 'rgba(254, 145, 0, 0.15)',
                border: '1px solid rgba(254, 145, 0, 0.4)',
                color: CI.orange
              }}
            >
              <span>Jetzt anrufen</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleAnswerComplete}
              disabled={!allRequiredAnswered || loading}
              className="flex-1 px-6 py-4 rounded-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02]"
              style={{
                background: !allRequiredAnswered || loading 
                  ? 'rgba(100, 100, 100, 0.3)'
                  : `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                border: `1px solid ${!allRequiredAnswered || loading ? 'rgba(255, 255, 255, 0.1)' : CI.orange}`,
                color: '#fff',
                boxShadow: !allRequiredAnswered || loading ? 'none' : `0 4px 20px ${CI.orange}40`,
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verarbeite...</span>
                </>
              ) : (
                <>
                  <span>Alle beantworten</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (step === 'settings') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        style={{
          background: 'rgba(10, 10, 10, 0.88)',
          backdropFilter: 'blur(14px)'
        }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative max-w-2xl w-full my-8"
          style={{
            background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.92), rgba(30, 30, 30, 0.85))',
            border: '1px solid rgba(254, 145, 0, 0.25)',
            borderRadius: '28px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(254, 145, 0, 0.1) inset'
          }}
        >
          <div className="relative p-8 pb-6">
            <div className="absolute top-0 left-0 right-0 h-32 opacity-20"
              style={{
                background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.3), transparent 70%)',
                filter: 'blur(40px)'
              }}
            />
            
            <div className="relative flex items-start gap-4">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, rgba(59, 130, 246, 0.25), ${CI.orange}15)`,
                  border: '1px solid rgba(59, 130, 246, 0.4)'
                }}
              >
                <Settings className="w-7 h-7 text-blue-400" />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black text-white mb-2"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Anruf-Einstellungen
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-300 text-sm"
                >
                  Personalisieren Sie das Gesprächsverhalten
                </motion.p>
              </div>
              
              <button
                onClick={onCancel}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all hover:scale-105"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-8 space-y-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🎭</span>
                <span>Tonalität des Gesprächs</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['formal', 'freundlich', 'neutral', 'direkt'].map((tone, idx) => (
                  <motion.button
                    key={tone}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + (idx * 0.05) }}
                    onClick={() => setSettings({ ...settings, tone })}
                    className="px-5 py-4 rounded-2xl font-semibold transition-all capitalize hover:scale-[1.02]"
                    style={{
                      background: settings.tone === tone
                        ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                        : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${settings.tone === tone ? CI.orange : 'rgba(255, 255, 255, 0.1)'}`,
                      color: settings.tone === tone ? '#fff' : '#9ca3af',
                      boxShadow: settings.tone === tone ? `0 4px 15px ${CI.orange}30` : 'none'
                    }}
                  >
                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <label className="block text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <span>Dringlichkeit</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['niedrig', 'mittel', 'hoch'].map((urgency, idx) => (
                  <motion.button
                    key={urgency}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + (idx * 0.05) }}
                    onClick={() => setSettings({ ...settings, urgency })}
                    className="px-5 py-4 rounded-2xl font-semibold transition-all capitalize hover:scale-[1.02]"
                    style={{
                      background: settings.urgency === urgency
                        ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                        : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${settings.urgency === urgency ? CI.orange : 'rgba(255, 255, 255, 0.1)'}`,
                      color: settings.urgency === urgency ? '#fff' : '#9ca3af',
                      boxShadow: settings.urgency === urgency ? `0 4px 15px ${CI.orange}30` : 'none'
                    }}
                  >
                    {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <label className="block text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">⏱️</span>
                <span>Maximale Gesprächsdauer: <span style={{ color: CI.orange }}>{Math.floor(settings.maxDuration / 60)}:{(settings.maxDuration % 60).toString().padStart(2, '0')}</span> Min</span>
              </label>
              <div className="relative px-2">
                <input
                  type="range"
                  min="60"
                  max="600"
                  step="30"
                  value={settings.maxDuration}
                  onChange={(e) => setSettings({ ...settings, maxDuration: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${CI.orange} 0%, ${CI.orange} ${((settings.maxDuration - 60) / (600 - 60)) * 100}%, rgba(255, 255, 255, 0.1) ${((settings.maxDuration - 60) / (600 - 60)) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-400 mt-3 px-2">
                <span>1 Min</span>
                <span>5 Min</span>
                <span>10 Min</span>
              </div>
            </motion.div>
          </div>

          <div className="px-8 pb-8 flex gap-3">
            <button
              onClick={() => setStep('questions')}
              className="px-6 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff'
              }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Zurück</span>
            </button>
            <button
              onClick={handleSettingsComplete}
              className="flex-1 px-6 py-4 rounded-2xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                border: `1px solid ${CI.orange}`,
                color: '#fff',
                boxShadow: `0 4px 20px ${CI.orange}40`,
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              <span>Weiter</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (step === 'review') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        style={{
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative max-w-4xl w-full my-8"
          style={{
            background: 'linear-gradient(145deg, rgba(20, 20, 20, 0.95), rgba(30, 30, 30, 0.88))',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '28px',
            backdropFilter: 'blur(30px)',
            boxShadow: '0 30px 100px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(34, 197, 94, 0.15) inset'
          }}
        >
          {/* Success Header */}
          <div className="relative p-8 pb-6">
            <div className="absolute top-0 left-0 right-0 h-40 opacity-25"
              style={{
                background: 'radial-gradient(ellipse at top, rgba(34, 197, 94, 0.4), transparent 70%)',
                filter: 'blur(50px)'
              }}
            />
            
            <div className="relative flex items-start gap-4">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(16, 185, 129, 0.2))',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  boxShadow: '0 0 30px rgba(34, 197, 94, 0.3)'
                }}
              >
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-black text-white mb-2"
                  style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  Anruf bereit! 🚀
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-300 text-sm"
                >
                  <span style={{ color: CI.orange, fontWeight: 600 }}>ARAS AI</span> hat Ihren Anruf optimiert und personalisiert
                </motion.p>
              </div>
              
              <button
                onClick={onCancel}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all hover:scale-105"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="px-8 mb-6 grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(233, 215, 196, 0.05))',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📞</span>
                <div className="text-xs font-bold text-gray-400">KONTAKT</div>
              </div>
              <div className="text-white font-bold text-lg">{contactName}</div>
              <div className="text-gray-400 text-sm mt-1">{phoneNumber}</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.05))',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚙️</span>
                <div className="text-xs font-bold text-gray-400">EINSTELLUNGEN</div>
              </div>
              <div className="text-white text-sm capitalize space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Ton:</span>
                  <span className="font-semibold">{settings.tone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Dringlichkeit:</span>
                  <span className="font-semibold">{settings.urgency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Max. Dauer:</span>
                  <span className="font-semibold">{Math.floor(settings.maxDuration / 60)} Min</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Prompt Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="px-8 mb-8"
          >
            <label className="block text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: CI.orange }} />
              <span>Ultra-Personalisierter Anruf-Prompt</span>
              <span className="text-xs px-2 py-1 rounded-full" style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#86efac',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                KI-Optimiert
              </span>
            </label>
            <div 
              className="p-6 rounded-2xl max-h-[400px] overflow-y-auto"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.06), rgba(233, 215, 196, 0.03))',
                border: '1px solid rgba(254, 145, 0, 0.25)',
                boxShadow: '0 8px 32px rgba(254, 145, 0, 0.1) inset'
              }}
            >
              <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-[1.8]">
                {finalPrompt}
              </pre>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="px-8 pb-8 flex gap-4">
            <button
              onClick={() => setStep('settings')}
              className="px-6 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff'
              }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Zurück</span>
            </button>
            <button
              onClick={handleStartCall}
              className="flex-1 px-8 py-5 rounded-2xl font-black transition-all hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: '1px solid #10b981',
                color: '#fff',
                boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              <Phone className="w-6 h-6" />
              <span>JETZT ANRUFEN</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return null;
}
