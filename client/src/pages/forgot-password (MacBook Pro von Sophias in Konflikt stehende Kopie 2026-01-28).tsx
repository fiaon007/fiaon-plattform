import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";

// ═══════════════════════════════════════════════════════════════
// MATRIX RAIN EFFECT
// ═══════════════════════════════════════════════════════════════
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = 'ARASAI01アラスエーアイ電話営業自動化';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Gradient from orange to gold
        const gradient = ctx.createLinearGradient(x, y - fontSize, x, y);
        gradient.addColorStop(0, 'rgba(254, 145, 0, 0.1)');
        gradient.addColorStop(0.5, 'rgba(254, 145, 0, 0.5)');
        gradient.addColorStop(1, '#FE9100');
        ctx.fillStyle = gradient;

        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 35);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-30"
      style={{ zIndex: 0 }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// TYPING ANIMATION
// ═══════════════════════════════════════════════════════════════
function TypingText({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        if (index <= text.length) {
          setDisplayText(text.slice(0, index));
          index++;
        } else {
          clearInterval(interval);
          setTimeout(() => setShowCursor(false), 1000);
        }
      }, 50);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span className={className}>
      {displayText}
      {showCursor && <span className="animate-pulse text-[#FE9100]">|</span>}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED GRADIENT BORDER
// ═══════════════════════════════════════════════════════════════
function GradientBorder({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-[#FE9100] via-[#A34E00] to-[#FE9100] opacity-75 blur-sm animate-gradient-shift" />
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[#FE9100] via-[#E9D7C4] to-[#FE9100] animate-gradient-shift" />
      <div className="relative bg-[#0a0a0a] rounded-2xl">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GLOWING ORB
// ═══════════════════════════════════════════════════════════════
function GlowingOrb({ size = 300, top, left, right, bottom, delay = 0 }: { 
  size?: number; 
  top?: string; 
  left?: string; 
  right?: string; 
  bottom?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.5, delay }}
      className="absolute pointer-events-none"
      style={{ top, left, right, bottom }}
    >
      <div 
        className="rounded-full animate-pulse-slow"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle, rgba(254, 145, 0, 0.15) 0%, rgba(254, 145, 0, 0.05) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setEmailSent(true);
        toast({
          title: "E-Mail gesendet",
          description: "Falls ein Account existiert, wurde ein Reset-Link gesendet.",
        });
      } else {
        toast({
          title: "Fehler",
          description: data.message || "Etwas ist schief gelaufen.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Verbindung zum Server fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      toast({
        title: "E-Mail erneut gesendet",
        description: "Falls ein Account existiert, wurde ein neuer Reset-Link gesendet.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Verbindung zum Server fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#030303]">
      {/* Matrix Rain Background */}
      <MatrixRain />

      {/* Glowing Orbs */}
      <GlowingOrb size={400} top="-10%" left="-5%" delay={0} />
      <GlowingOrb size={300} bottom="-5%" right="-5%" delay={0.3} />
      <GlowingOrb size={200} top="50%" left="50%" delay={0.6} />

      {/* Animated Grid Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-10" style={{ zIndex: 1 }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(254, 145, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(254, 145, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite',
        }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <GradientBorder>
            <div className="p-6 sm:p-8 md:p-10">
              {/* Logo & Back */}
              <div className="flex items-center justify-between mb-8">
                <motion.button
                  whileHover={{ x: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLocation("/auth")}
                  className="text-white/50 hover:text-[#FE9100] transition-colors text-sm flex items-center gap-2"
                >
                  <span className="text-lg">←</span>
                  <span>Zurück</span>
                </motion.button>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="text-xl sm:text-2xl font-bold"
                >
                  <span className="bg-gradient-to-r from-[#FE9100] via-[#E9D7C4] to-[#FE9100] bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                    ARAS AI
                  </span>
                </motion.div>
              </div>

              <AnimatePresence mode="wait">
                {!emailSent ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Title */}
                    <div className="text-center mb-8">
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
                        <span className="bg-gradient-to-r from-white via-[#FE9100] to-white bg-clip-text text-transparent">
                          <TypingText text="Passwort vergessen?" delay={500} />
                        </span>
                      </h1>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        className="text-white/50 text-sm sm:text-base"
                      >
                        Kein Problem. Wir senden dir einen Reset-Link.
                      </motion.p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <label className="block text-white/70 text-sm mb-2 font-medium">
                          E-Mail Adresse
                        </label>
                        <div className={`relative transition-all duration-300 ${isFocused ? 'transform scale-[1.02]' : ''}`}>
                          <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r from-[#FE9100] to-[#A34E00] opacity-0 transition-opacity duration-300 ${isFocused ? 'opacity-100' : ''}`} />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="deine@email.de"
                            required
                            className="relative w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-transparent transition-all duration-300"
                          />
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                      >
                        <motion.button
                          type="submit"
                          disabled={isLoading}
                          whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(254, 145, 0, 0.5)" }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-4 px-6 bg-gradient-to-r from-[#FE9100] to-[#A34E00] rounded-xl text-white font-bold text-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? (
                              <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Wird gesendet...</span>
                              </>
                            ) : (
                              <>
                                <span>Reset-Link anfordern</span>
                                <motion.span
                                  animate={{ x: [0, 5, 0] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                >
                                  →
                                </motion.span>
                              </>
                            )}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-[#A34E00] to-[#FE9100] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </motion.button>
                      </motion.div>
                    </form>

                    {/* Terminal-style info */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      className="mt-8 p-4 bg-black/50 rounded-xl border border-[#FE9100]/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-white/30 text-xs ml-2 font-mono">terminal</span>
                      </div>
                      <div className="font-mono text-xs text-[#FE9100]/70 space-y-1">
                        <p><span className="text-green-400">$</span> aras --password-reset</p>
                        <p className="text-white/50">→ Gib deine E-Mail ein</p>
                        <p className="text-white/50">→ Prüfe dein Postfach</p>
                        <p className="text-white/50">→ Klicke den Link</p>
                        <p className="text-green-400 animate-pulse">_ Bereit...</p>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    {/* Success Animation */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="w-24 h-24 mx-auto mb-6 relative"
                    >
                      <div className="absolute inset-0 bg-[#FE9100]/20 rounded-full animate-ping" />
                      <div className="absolute inset-0 bg-gradient-to-br from-[#FE9100] to-[#A34E00] rounded-full flex items-center justify-center">
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5, type: "spring" }}
                          className="text-4xl"
                        >
                          ✓
                        </motion.span>
                      </div>
                    </motion.div>

                    <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                      <span className="bg-gradient-to-r from-[#FE9100] to-[#E9D7C4] bg-clip-text text-transparent">
                        <TypingText text="E-Mail unterwegs!" delay={300} />
                      </span>
                    </h2>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      className="text-white/50 mb-2"
                    >
                      Falls ein Account existiert, haben wir einen Reset-Link an
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                      className="text-[#FE9100] font-mono mb-6"
                    >
                      {email}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.4 }}
                      className="text-white/50 mb-8"
                    >
                      gesendet.
                    </motion.p>

                    <div className="space-y-4">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.6 }}
                        className="p-4 bg-white/5 rounded-xl border border-white/10"
                      >
                        <p className="text-white/70 text-sm">
                          Keine E-Mail erhalten? Prüfe deinen <span className="text-[#FE9100]">Spam-Ordner</span> oder versuche es erneut.
                        </p>
                      </motion.div>

                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.8 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleResendEmail}
                        disabled={isLoading}
                        className="w-full py-3 px-6 border border-[#FE9100]/50 rounded-xl text-[#FE9100] font-medium hover:bg-[#FE9100]/10 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-[#FE9100]/30 border-t-[#FE9100] rounded-full animate-spin" />
                            Wird gesendet...
                          </span>
                        ) : (
                          "Erneut senden"
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-8 pt-6 border-t border-white/10 text-center"
              >
                <p className="text-white/40 text-sm">
                  Passwort wieder eingefallen?{" "}
                  <Link href="/auth" className="text-[#FE9100] hover:text-[#E9D7C4] transition-colors font-medium">
                    Zur Anmeldung
                  </Link>
                </p>
              </motion.div>
            </div>
          </GradientBorder>

          {/* Bottom Branding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2 }}
            className="mt-8 text-center"
          >
            <p className="text-white/20 text-xs font-mono">
              ARAS AI® – Die Zukunft der KI-Kommunikation
            </p>
            <p className="text-white/10 text-xs mt-1">
              Entwickelt von der Schwarzott Group
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-shift {
          animation: gradient-shift 3s ease infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  );
}