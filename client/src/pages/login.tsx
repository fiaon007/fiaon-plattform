import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, Phone, ArrowRight, Eye, EyeOff, Zap, Target, TrendingUp, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { loginMutation } = useAuth();
  const isLoading = loginMutation.isPending;

  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);

  const features = [
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Eigenes LLM (ARAS Core)",
      subtitle: "Proprietäres Sprachmodell für menschliche Gespräche",
      accent: "from-blue-400 to-cyan-500"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "500+ Parallele Anrufe", 
      subtitle: "Unbegrenzte Skalierung ohne Qualitätsverlust",
      accent: "from-primary to-orange-500"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "DSGVO-Konform",
      subtitle: "100% Datenschutz aus Schweizer Rechenzentren", 
      accent: "from-green-400 to-emerald-500"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "CRM-Integration",
      subtitle: "Nahtlose Anbindung an Salesforce, HubSpot & mehr",
      accent: "from-purple-400 to-violet-500"
    }
  ];

  const taglines = [
    "Die erste KI-Outbound-Telefonie-Plattform für skalierbaren B2B-Vertrieb",
    "Menschliche Sprachqualität trifft auf unbegrenzte Skalierung",
    "Automatisieren Sie Ihre B2B-Telefonakquise - DSGVO-konform & erfolgreich", 
    "Von Zürich für die DACH-Region: Schweizer Präzision in der KI-Telefonie"
  ];

  // Auto-rotate features every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  // Auto-rotate taglines every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [taglines.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      toast({
        title: "Login erfolgreich",
        description: "Willkommen zurück bei ARAS AI!",
      });
      setLocation("/space");
    } catch (error: any) {
      const msg = error?.code === "ACCOUNT_DISABLED"
        ? "Dein Account wurde deaktiviert. Bitte kontaktiere den Support."
        : "Ungültige Anmeldedaten. Bitte überprüfe Benutzername und Passwort.";
      toast({
        title: "Login fehlgeschlagen",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleForgotPassword = () => {
    setLocation("/forgot-password");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Dynamic Content */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
        
        {/* Animated background particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/20 rounded-full"
              animate={{
                x: [0, 100, 0],
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 8,
                delay: i * 0.4,
                repeat: Infinity,
              }}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 p-12 flex flex-col justify-center">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl font-orbitron font-bold"
            >
              <GradientText>ARAS AI</GradientText>
            </motion.div>
            
            {/* Dynamic tagline with smooth transitions */}
            <div className="h-16 flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentTaglineIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-xl text-muted-foreground leading-relaxed"
                >
                  {taglines[currentTaglineIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Dynamic feature showcase */}
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFeatureIndex}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="relative"
                >
                  <div className="flex items-center space-x-4 p-6 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/50">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${features[currentFeatureIndex].accent} shadow-lg`}>
                      <div className="text-white">
                        {features[currentFeatureIndex].icon}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground font-orbitron">
                        {features[currentFeatureIndex].title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {features[currentFeatureIndex].subtitle}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Feature dots indicator */}
              <div className="flex justify-center space-x-2">
                {features.map((_, index) => (
                  <motion.button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentFeatureIndex
                        ? "bg-primary w-6"
                        : "bg-muted-foreground/30"
                    }`}
                    onClick={() => setCurrentFeatureIndex(index)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  />
                ))}
              </div>
            </div>

            {/* Floating stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="grid grid-cols-3 gap-4 pt-8"
            >
              {[
                { label: "Anrufe getätigt", value: "500K+", icon: <Phone className="w-4 h-4" /> },
                { label: "Leads qualifiziert", value: "120K+", icon: <Users className="w-4 h-4" /> },
                { label: "ROI-Steigerung", value: "340%", icon: <Sparkles className="w-4 h-4" /> },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className="text-center p-3 rounded-lg bg-card/20 backdrop-blur-sm"
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="flex justify-center mb-1 text-primary">
                    {stat.icon}
                  </div>
                  <div className="text-lg font-bold font-orbitron text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-orbitron font-bold mb-2">
                  <GradientText>Willkommen zurück</GradientText>
                </h1>
                <p className="text-muted-foreground">
                  Melden Sie sich bei Ihrer ARAS AI KI-Telefonie-Plattform an
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="username">Benutzername</Label>
                  <Input 
                    id="username" 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Dein Benutzername"
                    required
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative mt-1">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ihr Passwort"
                      required
                      className="pr-10"
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Angemeldet bleiben
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 font-normal"
                    onClick={handleForgotPassword}
                  >
                    Passwort vergessen?
                  </Button>
                </div>
                
                <GlowButton
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Anmeldung läuft..." : "Anmelden"}
                </GlowButton>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Noch kein ARAS AI Konto?{" "}
                  <Link href="/signup" className="text-primary hover:underline">
                    Jetzt kostenlos testen
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}