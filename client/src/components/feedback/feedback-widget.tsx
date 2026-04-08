import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { SupportDock } from '@/components/support/SupportDock';
import html2canvas from 'html2canvas';

// ARAS CI Colors
const CI = {
  orange: '#FE9100',
  goldLight: '#E9D7C4',
  goldDark: '#A34E00',
};

type FeedbackType = 'feedback' | 'bug';

// Typing Animation Hook
const useTypingAnimation = (text: string, speed: number = 80) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let index = 0;
    setDisplayText('');
    const timer = setInterval(() => {
      if (index <= text.length) {
        setDisplayText(text.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return displayText;
};

export function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('feedback');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Typing animations for titles
  const feedbackTitle = useTypingAnimation(type === 'feedback' ? 'Feedback teilen' : 'Bug melden', 50);
  
  // Success message typing animation
  const username = (user as any)?.username || 'User';
  const successMessage = type === 'bug' 
    ? `Vielen Dank für deinen Bug Report, ${username}! Das hilft uns sehr weiter. Der Bug sollte in den nächsten Stunden behoben sein.`
    : `Vielen Dank für dein Feedback, ${username}! Das hilft uns sehr weiter. Wir melden uns innerhalb von 24-48h bei dir.`;
  const successText = useTypingAnimation(showSuccess ? successMessage : '', 30);

  // Get browser info
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    let os = 'Unknown';

    // Browser detection
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge')) browser = 'Edge';

    // OS detection
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return {
      browser,
      version,
      os,
      screen: `${window.screen.width}x${window.screen.height}`,
    };
  };

  // Capture screenshot
  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      setIsOpen(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: 0.5,
      });
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshot(dataUrl);
      setIsOpen(true);
      
      toast({
        title: '📸 Screenshot erfasst!',
        description: 'Screenshot wurde hinzugefügt',
      });
    } catch (error) {
      console.error('Screenshot error:', error);
      toast({
        title: '❌ Screenshot fehlgeschlagen',
        description: 'Konnte kein Screenshot erstellen',
        variant: 'destructive',
      });
      setIsOpen(true);
    } finally {
      setIsCapturing(false);
    }
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[Feedback] Submitting:', data);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      const responseData = await res.json();
      console.log('[Feedback] Response:', responseData);
      
      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to submit');
      }
      return responseData;
    },
    onSuccess: (data) => {
      console.log('[Feedback] Success:', data);
      
      // Show success screen
      setShowSuccess(true);
      
      // Also show toast
      toast({
        title: type === 'bug' ? '🐛 Bug gemeldet!' : '⭐ Feedback gesendet!',
        description: `Vielen Dank, ${username}!`,
        duration: 5000,
      });
      
      // Close after success message is shown (5 seconds)
      setTimeout(() => {
        setShowSuccess(false);
        setType('feedback');
        setRating(0);
        setTitle('');
        setDescription('');
        setScreenshot(null);
        setIsOpen(false);
      }, 6000);
    },
    onError: (error: Error) => {
      console.error('[Feedback] Error:', error);
      toast({
        title: '❌ Fehler beim Senden',
        description: error.message || 'Bitte versuche es erneut',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({
        title: '❌ Fehler',
        description: 'Bitte Beschreibung eingeben!',
        variant: 'destructive',
      });
      return;
    }

    if (type === 'feedback' && rating === 0) {
      toast({
        title: '❌ Fehler',
        description: 'Bitte Bewertung abgeben!',
        variant: 'destructive',
      });
      return;
    }

    const feedbackData = {
      type,
      rating: type === 'feedback' ? rating : null,
      title: title || null,
      description,
      screenshot: screenshot || null,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: getBrowserInfo(),
    };

    console.log('[Feedback] Submitting data:', feedbackData);
    submitMutation.mutate(feedbackData);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Support Dock - using SupportDock component */}
      {!isOpen && (
        <SupportDock autoHideMs={5000}>
          {/* Live-Chat Button - WhatsApp */}
          <a
            href="https://chat.whatsapp.com/GWx5JKr4RDfGduidjkzZfj?mode=hqrc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs font-['Orbitron'] whitespace-nowrap transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.4)',
              color: '#25D366',
            }}
          >
            💚 Live-Chat
          </a>

          {/* Alpha Feedback Button */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs font-['Orbitron'] whitespace-nowrap transition-all hover:scale-[1.02]"
            style={{
              background: `rgba(254, 145, 0, 0.1)`,
              border: `1px solid ${CI.orange}60`,
              color: CI.orange,
            }}
          >
            💬 Alpha Feedback
          </button>
        </SupportDock>
      )}

      {/* Modal - REDESIGNED: Kleiner, cleaner, transparenter */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)' }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl p-6 relative overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.7)',
                border: '2px solid',
                borderImageSlice: 1,
                boxShadow: `0 0 40px ${CI.orange}40`,
                backdropFilter: 'blur(20px)',
                animation: 'border-flow 3s linear infinite',
              }}
            >
              {/* SUCCESS SCREEN */}
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 z-50"
                  style={{
                    background: 'rgba(0,0,0,0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '1.5rem',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-7xl mb-6"
                  >
                    {type === 'bug' ? '🐛' : '⭐'}
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold mb-4 text-center font-['Orbitron']" style={{
                    background: `linear-gradient(135deg, ${CI.goldLight}, ${CI.orange})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    {type === 'bug' ? 'Bug gemeldet!' : 'Feedback gesendet!'}
                  </h3>
                  
                  <p className="text-base text-center leading-relaxed mb-6 min-h-[4rem]" style={{ color: CI.goldLight }}>
                    {successText}
                    <motion.span 
                      animate={{ opacity: [0, 1, 0] }} 
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      |
                    </motion.span>
                  </p>
                  
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl"
                  >
                    ✨
                  </motion.div>
                </motion.div>
              )}
              {/* Header - Typing Animation */}
              <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2 font-['Orbitron'] min-h-[2.5rem]" style={{
                  background: `linear-gradient(135deg, ${CI.goldLight}, ${CI.orange})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {feedbackTitle}<motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
                </h2>
                <p className="text-sm" style={{ color: `${CI.goldLight}90` }}>
                  Hilf uns, ARAS AI zu verbessern! 🚀
                </p>
              </div>

              {/* Type Selection - Kompakter */}
              <div className="flex gap-3 mb-5">
                {[
                  { value: 'feedback', label: '⭐ Feedback' },
                  { value: 'bug', label: '🐛 Bug' },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setType(option.value as FeedbackType)}
                    className="flex-1 p-4 rounded-xl text-center font-bold font-['Orbitron']"
                    style={{
                      background: type === option.value
                        ? `rgba(${parseInt(CI.orange.slice(1,3), 16)}, ${parseInt(CI.orange.slice(3,5), 16)}, ${parseInt(CI.orange.slice(5,7), 16)}, 0.2)`
                        : 'rgba(255,255,255,0.02)',
                      border: `2px solid ${type === option.value ? CI.orange : 'rgba(255,255,255,0.1)'}`,
                      color: type === option.value ? CI.orange : CI.goldLight,
                      boxShadow: type === option.value ? `0 0 15px ${CI.orange}30` : 'none',
                    }}
                  >
                    {option.label}
                  </motion.button>
                ))}
              </div>

              {/* Rating (nur für Feedback) - Kompakter */}
              {type === 'feedback' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5"
                >
                  <label className="block text-xs font-bold mb-2" style={{ color: CI.goldLight }}>
                    Bewertung *
                  </label>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRating(star)}
                        className="text-3xl"
                        style={{
                          color: star <= rating ? CI.orange : 'rgba(255,255,255,0.2)',
                          textShadow: star <= rating ? `0 0 10px ${CI.orange}` : 'none',
                          filter: star <= rating ? 'drop-shadow(0 0 5px rgba(254,145,0,0.5))' : 'none',
                        }}
                      >
                        ⭐
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Title - Kompakter */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-2" style={{ color: CI.goldLight }}>
                  Titel (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Kurze Zusammenfassung..."
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${CI.orange}20`,
                    backdropFilter: 'blur(10px)',
                  }}
                />
              </div>

              {/* Description - Kompakter */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-2" style={{ color: CI.goldLight }}>
                  Beschreibung *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={type === 'bug' ? 'Was ist passiert? Welche Schritte führen zum Fehler?' : 'Was gefällt dir? Was könnten wir verbessern?'}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none resize-none transition-all"
                  rows={4}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${CI.orange}20`,
                    backdropFilter: 'blur(10px)',
                  }}
                />
              </div>

              {/* Screenshot - Kompakter */}
              <div className="mb-5">
                {screenshot ? (
                  <div className="relative">
                    <img
                      src={screenshot}
                      alt="Screenshot"
                      className="w-full rounded-xl max-h-32 object-cover"
                      style={{ border: `1px solid ${CI.orange}50` }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setScreenshot(null)}
                      className="absolute top-2 right-2 px-3 py-1 rounded-lg font-bold text-xs"
                      style={{
                        background: 'rgba(255,0,0,0.9)',
                        color: '#fff',
                      }}
                    >
                      ❌
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={captureScreenshot}
                    disabled={isCapturing}
                    className="w-full p-3 rounded-xl font-bold text-xs"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px dashed ${CI.orange}30`,
                      color: CI.goldLight,
                    }}
                  >
                    {isCapturing ? '📸 Erfasse...' : '📸 Screenshot'}
                  </motion.button>
                )}
              </div>

              {/* Actions - Kompakter */}
              <div className="flex gap-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold text-sm font-['Orbitron']"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                    opacity: submitMutation.isPending ? 0.5 : 1,
                    boxShadow: `0 0 20px ${CI.orange}40`,
                  }}
                >
                  {submitMutation.isPending ? '⏳ Sende...' : type === 'bug' ? '🐛 Senden' : '⭐ Senden'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-sm font-['Orbitron']"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: CI.goldLight,
                  }}
                >
                  Abbrechen
                </motion.button>
              </div>

              {/* Info - Kompakter */}
              <div className="p-3 rounded-xl" style={{ 
                background: `rgba(${parseInt(CI.orange.slice(1,3), 16)}, ${parseInt(CI.orange.slice(3,5), 16)}, ${parseInt(CI.orange.slice(5,7), 16)}, 0.08)`,
                border: `1px solid ${CI.orange}20`,
              }}>
                <p className="text-xs font-bold mb-1" style={{ color: CI.goldLight }}>
                  📡 Wohin kommt dein Feedback?
                </p>
                <p className="text-xs leading-relaxed" style={{ color: `${CI.goldLight}70` }}>
                  Direkt in unsere Datenbank → Team wird benachrichtigt → Antwort in 24-48h
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capturing overlay */}
      {isCapturing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 border-4 rounded-full"
            style={{
              borderColor: `${CI.orange}40`,
              borderTopColor: CI.orange,
            }}
          />
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes border-flow {
          0%, 100% {
            border-image-source: linear-gradient(135deg, ${CI.orange}, ${CI.goldLight});
          }
          50% {
            border-image-source: linear-gradient(135deg, ${CI.goldLight}, ${CI.orange});
          }
        }

        @keyframes text-flow {
          0%, 100% {
            color: ${CI.goldLight};
            text-shadow: 0 0 10px ${CI.goldLight}60;
          }
          33% {
            color: ${CI.orange};
            text-shadow: 0 0 10px ${CI.orange}60;
          }
          66% {
            color: white;
            text-shadow: 0 0 10px rgba(255,255,255,0.6);
          }
        }

        @keyframes border-flow-green {
          0%, 100% {
            border-image-source: linear-gradient(135deg, #25D366, #128C7E);
          }
          50% {
            border-image-source: linear-gradient(135deg, #128C7E, #25D366);
          }
        }

        @keyframes text-flow-green {
          0%, 100% {
            color: #25D366;
            text-shadow: 0 0 10px rgba(37, 211, 102, 0.6);
          }
          33% {
            color: #128C7E;
            text-shadow: 0 0 10px rgba(18, 140, 126, 0.6);
          }
          66% {
            color: #DCF8C6;
            text-shadow: 0 0 10px rgba(220, 248, 198, 0.6);
          }
        }

        @keyframes glow-green {
          0%, 100% {
            box-shadow: 0 0 20px rgba(37, 211, 102, 0.4), 0 0 40px rgba(37, 211, 102, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(37, 211, 102, 0.6), 0 0 60px rgba(37, 211, 102, 0.3);
          }
        }

        @keyframes glow-orange {
          0%, 100% {
            box-shadow: 0 0 20px ${CI.orange}40, 0 0 40px ${CI.orange}20;
          }
          50% {
            box-shadow: 0 0 30px ${CI.orange}60, 0 0 60px ${CI.orange}30;
          }
        }
      `}</style>
    </>
  );
}
