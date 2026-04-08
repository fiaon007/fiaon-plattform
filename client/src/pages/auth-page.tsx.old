import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (password !== confirmPassword) {
        toast({
          title: "Fehler",
          description: "Passwörter stimmen nicht überein",
          variant: "destructive",
        });
        return;
      }
      
      if (!agreeToTerms) {
        toast({
          title: "Fehler",
          description: "Bitte akzeptieren Sie die Nutzungsbedingungen",
          variant: "destructive",
        });
        return;
      }
    }

    window.location.href = "/api/login";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <img src={arasLogo} alt="Loading" className="w-16 h-16 object-contain" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-black relative overflow-hidden">
      {/* Premium Animated Background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(circle at 20% 30%, rgba(254, 145, 0, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(163, 78, 0, 0.12) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(233, 215, 196, 0.08) 0%, transparent 70%)'
          }}
        />
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(254, 145, 0, 0.2) 0%, transparent 70%)'
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, 150, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(163, 78, 0, 0.15) 0%, transparent 70%)'
          }}
          animate={{
            x: [0, -100, 0],
            y: [0, -150, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* LEFT SIDE: Hero Content */}
      <div className="hidden lg:flex lg:w-[58%] relative z-10">
        <div className="w-full h-full flex flex-col justify-center px-20 py-16">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-16"
          >
            <img src={arasLogo} alt="ARAS AI" className="w-20 h-20 object-contain mb-6" />
            <motion.div
              className="inline-block"
              style={{
                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                backgroundSize: '200% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            >
              <h1 
                className="text-6xl font-black tracking-tight"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                ARAS AI
              </h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-500 text-sm mt-2 tracking-widest"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Welcome to the Future of Outbound
            </motion.p>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-12"
          >
            <h2 
              className="text-5xl font-black leading-tight mb-6"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <motion.span
                className="block"
                style={{
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                THE WORLD'S MOST
              </motion.span>
              <motion.span
                className="block mt-2"
                style={{
                  background: 'linear-gradient(135deg, #FE9100, #a34e00)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                HUMAN AI CALL SYSTEM
              </motion.span>
            </h2>
            
            <p 
              className="text-gray-400 text-lg leading-relaxed max-w-2xl"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Die Stimme, die verkauft. Die KI, die versteht. ARAS AI führt reale Gespräche — 
              automatisiert, empathisch und grenzenlos skalierbar. Jeder Anruf ein Dialog, kein Skript. 
              Bis zu 500 Anrufe gleichzeitig. Echtzeit. Menschlich. Effizient.
            </p>
          </motion.div>

          {/* Early Access Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative group"
          >
            {/* Animated border */}
            <motion.div
              className="absolute -inset-[2px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                backgroundSize: '300% 100%'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />

            <div 
              className="relative rounded-2xl p-8"
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(40px)',
              }}
            >
              <div className="flex items-start gap-4 mb-6">
                <motion.div
                  className="w-2 h-2 rounded-full mt-2"
                  style={{ background: '#FE9100', boxShadow: '0 0 20px rgba(254, 145, 0, 0.8)' }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.5, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div>
                  <h3 
                    className="text-2xl font-bold mb-3"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    EARLY ACCESS 2025
                  </h3>
                  <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                    LIMITED RELEASE
                  </p>
                  
                  <p className="text-gray-400 text-sm leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Willkommen in der exklusiven Testphase von ARAS AI. Unsere Plattform ist live, 
                    aber befindet sich noch in der finalen Entwicklungsphase.
                  </p>

                  <div className="space-y-2 mb-6">
                    {[
                      'Neue Funktionen werden fortlaufend freigeschaltet',
                      'Es kann zu kurzfristigen Systemupdates kommen',
                      'Ihr Feedback fließt direkt in die finale Version ein'
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <div 
                          className="w-1 h-1 rounded-full mt-2 flex-shrink-0"
                          style={{ background: '#FE9100' }}
                        />
                        <span className="text-gray-500 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {item}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Official Launch
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span 
                        className="text-3xl font-black"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          background: 'linear-gradient(90deg, #FE9100, #a34e00)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        01 · 01 · 2026
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Sie sind Teil der Zukunft — bevor sie beginnt.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-12 pt-8 border-t border-white/5"
          >
            <p className="text-xs text-gray-600 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Together, we're building the next era of communication.
            </p>
            <p className="text-xs text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              Von Zürich in die Welt – powered by Schwarzott Group AG
            </p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="w-full lg:w-[42%] relative z-10 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Form Container with animated border */}
          <div className="relative group">
            <motion.div
              className="absolute -inset-[1px] rounded-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                backgroundSize: '200% 200%'
              }}
              animate={{
                backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
              }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />

            <div 
              className="relative rounded-3xl p-10"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(40px)',
              }}
            >
              {/* Form Header */}
              <div className="text-center mb-8">
                <motion.h2
                  className="text-3xl font-black mb-2"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                >
                  {isSignUp ? "Account erstellen" : "Willkommen zurück"}
                </motion.h2>
                <p className="text-gray-500 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {isSignUp 
                    ? "Starten Sie Ihre ARAS AI Journey" 
                    : "Melden Sie sich an, um fortzufahren"
                  }
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence mode="wait">
                  {isSignUp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <Label htmlFor="firstName" className="text-gray-400 text-xs mb-2 block">
                          Vorname
                        </Label>
                        <Input 
                          id="firstName" 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#FE9100]/50 rounded-xl"
                          placeholder="Max"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-gray-400 text-xs mb-2 block">
                          Nachname
                        </Label>
                        <Input 
                          id="lastName" 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#FE9100]/50 rounded-xl"
                          placeholder="Mustermann"
                          required
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <Label htmlFor="email" className="text-gray-400 text-xs mb-2 block">
                    E-Mail Adresse
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#FE9100]/50 rounded-xl"
                    placeholder="max@beispiel.de"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-gray-400 text-xs mb-2 block">
                    Passwort
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#FE9100]/50 rounded-xl"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <AnimatePresence mode="wait">
                  {isSignUp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Label htmlFor="confirmPassword" className="text-gray-400 text-xs mb-2 block">
                        Passwort bestätigen
                      </Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#FE9100]/50 rounded-xl"
                        placeholder="••••••••"
                        required
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id={isSignUp ? "terms" : "remember"}
                      checked={isSignUp ? agreeToTerms : rememberMe}
                      onCheckedChange={(checked) => 
                        isSignUp 
                          ? setAgreeToTerms(checked as boolean)
                          : setRememberMe(checked as boolean)
                      }
                      className="border-white/20"
                    />
                    <Label 
                      htmlFor={isSignUp ? "terms" : "remember"} 
                      className="text-xs text-gray-500 cursor-pointer"
                    >
                      {isSignUp ? "AGB akzeptieren" : "Angemeldet bleiben"}
                    </Label>
                  </div>
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs text-[#FE9100] hover:text-[#FE9100]/80 transition-colors"
                      onClick={() => toast({ title: "Passwort-Reset kommt bald" })}
                    >
                      Passwort vergessen?
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <motion.div className="relative pt-2">
                  <motion.div
                    className="absolute -inset-[2px] rounded-full opacity-75"
                    style={{
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                      backgroundSize: '300% 100%',
                      filter: 'blur(8px)'
                    }}
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ 
                      backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' },
                      opacity: { duration: 2, repeat: Infinity }
                    }}
                  />

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative w-full h-12 rounded-full font-bold text-base tracking-wide transition-all"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                      backgroundSize: '200% 100%',
                      color: '#000000'
                    }}
                  >
                    {isSignUp ? "Account erstellen" : "Anmelden"}
                  </motion.button>
                </motion.div>
              </form>

              {/* Toggle Sign Up/In */}
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {isSignUp ? "Bereits registriert?" : "Noch kein Account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[#FE9100] hover:text-[#FE9100]/80 transition-colors font-semibold"
                  >
                    {isSignUp ? "Anmelden" : "Registrieren"}
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Legal Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 text-center"
          >
            <p className="text-xs text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              DSGVO-konform · Swiss Hosting · SOC2 zertifiziert
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}