import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

// ARAS CI Colors
const CI = {
  orange: '#FE9100',
  goldLight: '#E9D7C4',
  goldDark: '#A34E00',
};

type FeedbackType = 'feedback' | 'bug';

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
      // Hide the widget temporarily
      setIsOpen(false);
      
      // Wait a bit for animation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: 0.5, // Reduce quality for smaller file size
      });
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshot(dataUrl);
      
      // Reopen widget
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
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to submit');
      }
      return res.json();
    },
    onSuccess: () => {
      const username = (user as any)?.username || 'User';
      toast({
        title: type === 'bug' ? '🐛 Bug gemeldet!' : '⭐ Feedback gesendet!',
        description: `Vielen Dank für dein Feedback, ${username}! Wir melden uns innerhalb von 24-48h bei dir.`,
      });
      // Reset form
      setType('feedback');
      setRating(0);
      setTitle('');
      setDescription('');
      setScreenshot(null);
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Fehler',
        description: error.message,
        variant: 'destructive',
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

    submitMutation.mutate({
      type,
      rating: type === 'feedback' ? rating : null,
      title: title || null,
      description,
      screenshot: screenshot || null,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: getBrowserInfo(),
    });
  };

  if (!user) return null; // Only show for logged-in users

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ 
              scale: 1.1, 
              boxShadow: `0 0 30px ${CI.orange}80, 0 0 60px ${CI.orange}40`
            }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-8 z-40 p-5 rounded-full font-bold text-sm shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
              color: '#000',
              boxShadow: `0 0 20px ${CI.orange}60`,
            }}
          >
            💬 Alpha Feedback
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl p-8 relative overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.95)',
                border: `2px solid ${CI.orange}`,
                boxShadow: `0 0 40px ${CI.orange}60`,
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-4xl font-bold mb-3 font-['Orbitron']" style={{
                  background: `linear-gradient(135deg, ${CI.goldLight}, ${CI.orange})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Alpha Feedback
                </h2>
                <p style={{ color: CI.goldLight }}>
                  Hilf uns, ARAS AI zu verbessern! 🚀
                </p>
              </div>

              {/* Type Selection */}
              <div className="flex gap-4 mb-6">
                {[
                  { value: 'feedback', label: '⭐ Feedback', desc: 'Teile deine Meinung' },
                  { value: 'bug', label: '🐛 Bug Report', desc: 'Melde einen Fehler' },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setType(option.value as FeedbackType)}
                    className="flex-1 p-5 rounded-2xl text-left"
                    style={{
                      background: type === option.value
                        ? `linear-gradient(135deg, ${CI.orange}30, ${CI.goldDark}20)`
                        : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${type === option.value ? CI.orange : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: type === option.value ? `0 0 20px ${CI.orange}40` : 'none',
                    }}
                  >
                    <div className="text-2xl mb-2">{option.label}</div>
                    <div className="text-sm" style={{ color: CI.goldLight }}>
                      {option.desc}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Rating (nur für Feedback) */}
              {type === 'feedback' && (
                <div className="mb-6">
                  <label className="block text-sm font-bold mb-3" style={{ color: CI.goldLight }}>
                    Bewertung *
                  </label>
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.2, rotate: 15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRating(star)}
                        className="text-5xl"
                        style={{
                          color: star <= rating ? CI.orange : 'rgba(255,255,255,0.2)',
                          textShadow: star <= rating ? `0 0 10px ${CI.orange}` : 'none',
                        }}
                      >
                        ⭐
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3" style={{ color: CI.goldLight }}>
                  Titel (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Kurze Zusammenfassung..."
                  className="w-full px-5 py-4 rounded-2xl text-white focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `2px solid ${CI.orange}30`,
                  }}
                />
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3" style={{ color: CI.goldLight }}>
                  Beschreibung *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={type === 'bug' ? 'Was ist passiert? Welche Schritte führen zum Fehler?' : 'Was gefällt dir? Was könnten wir verbessern?'}
                  className="w-full px-5 py-4 rounded-2xl text-white focus:outline-none resize-none"
                  rows={6}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `2px solid ${CI.orange}30`,
                  }}
                />
              </div>

              {/* Screenshot */}
              <div className="mb-8">
                {screenshot ? (
                  <div className="relative">
                    <img
                      src={screenshot}
                      alt="Screenshot"
                      className="w-full rounded-2xl"
                      style={{ border: `2px solid ${CI.orange}` }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setScreenshot(null)}
                      className="absolute top-3 right-3 px-4 py-2 rounded-xl font-bold text-sm"
                      style={{
                        background: 'rgba(255,0,0,0.9)',
                        color: '#fff',
                      }}
                    >
                      ❌ Entfernen
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: `0 0 20px ${CI.orange}40` }}
                    whileTap={{ scale: 0.97 }}
                    onClick={captureScreenshot}
                    disabled={isCapturing}
                    className="w-full p-5 rounded-2xl font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px dashed ${CI.orange}30`,
                      color: CI.goldLight,
                    }}
                  >
                    {isCapturing ? '📸 Erfasse...' : '📸 Screenshot hinzufügen (optional)'}
                  </motion.button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: `0 0 30px ${CI.orange}60` }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex-1 py-4 rounded-2xl font-bold text-lg font-['Orbitron']"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                    opacity: submitMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {submitMutation.isPending ? 'Sende...' : type === 'bug' ? '🐛 Bug melden' : '⭐ Feedback senden'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsOpen(false)}
                  className="px-8 py-4 rounded-2xl font-bold font-['Orbitron']"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: CI.goldLight,
                  }}
                >
                  Abbrechen
                </motion.button>
              </div>

              {/* Info */}
              <div className="mt-6 p-4 rounded-2xl" style={{ 
                background: `rgba(${parseInt(CI.orange.slice(1,3), 16)}, ${parseInt(CI.orange.slice(3,5), 16)}, ${parseInt(CI.orange.slice(5,7), 16)}, 0.1)`,
                border: `1px solid ${CI.orange}30`,
              }}>
                <p className="text-xs mb-2 font-bold" style={{ color: CI.goldLight }}>
                  📡 Wohin kommt dein Feedback?
                </p>
                <p className="text-xs" style={{ color: `${CI.goldLight}80` }}>
                  • Wird direkt in unserer Datenbank gespeichert<br />
                  • ARAS AI Team wird sofort benachrichtigt<br />
                  • Enthält automatisch: URL, Browser, Screenshot<br />
                  • Antwort innerhalb von 24-48h an dich!
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
    </>
  );
}
