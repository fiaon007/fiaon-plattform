import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Bot, Users, Phone, ArrowRight, Eye, EyeOff, Check } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { registerMutation } = useAuth();
  const isLoading = registerMutation.isPending;

  const features = [
    {
      icon: <Bot className="w-5 h-5" />,
      title: "Eigenes LLM 'ARAS Core' - Keine Abhängigkeit von externen AI-Anbietern",
      delay: 0,
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "500+ parallele Anrufe mit menschlicher Sprachqualität",
      delay: 0.2,
    },
    {
      icon: <Phone className="w-5 h-5" />,
      title: "100% DSGVO-konform aus Schweizer Rechenzentren",
      delay: 0.4,
    },
  ];

  const passwordRequirements = [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "One uppercase letter", met: /[A-Z]/.test(password) },
    { text: "One lowercase letter", met: /[a-z]/.test(password) },
    { text: "One number", met: /\d/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (!agreeToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    // Phone validation (required by backend, min 8 chars)
    if (!phone.trim() || phone.trim().length < 8) {
      toast({
        title: "Telefonnummer fehlt",
        description: "Bitte gib eine gültige Telefonnummer ein (mind. 8 Zeichen).",
        variant: "destructive",
      });
      return;
    }

    try {
      const username = email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
      
      await registerMutation.mutateAsync({
        username,
        password,
        email,
        firstName,
        lastName,
        phone,
        language: 'de',
      });
      
      toast({
        title: "Account erstellt!",
        description: "Willkommen bei ARAS AI! Dein Account wurde erfolgreich erstellt.",
      });
      
      setLocation("/space");
    } catch (error: any) {
      console.error('Signup error:', error);
      const msg = error.message || '';
      let description = "Etwas ist schiefgelaufen. Bitte erneut versuchen.";
      if (msg.includes('E-Mail') || msg.includes('email')) {
        description = "Diese E-Mail ist bereits registriert. Bitte einloggen.";
      } else if (msg.includes('Benutzername') || msg.includes('username')) {
        description = "Benutzername vergeben. Bitte erneut versuchen.";
      } else if (msg.includes('Telefon') || msg.includes('phone')) {
        description = "Bitte gib eine gültige Telefonnummer ein.";
      } else if (msg) {
        description = msg;
      }
      toast({
        title: "Registrierung fehlgeschlagen",
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Dynamic Content */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-orbitron font-bold"
            >
              <GradientText>ARAS AI</GradientText>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground"
            >
              Die erste KI-Outbound-Telefonie-Plattform für skalierbaren B2B-Vertrieb
            </motion.div>
            
            <div className="space-y-4 mt-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    delay: feature.delay,
                    type: "spring",
                    stiffness: 100 
                  }}
                  className="bg-card/50 p-4 rounded-lg border border-border hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex items-center space-x-3">
                    <motion.div 
                      className="w-2 h-2 bg-primary rounded-full"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <span className="text-muted-foreground">{feature.title}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Animated Background Elements */}
            <motion.div 
              className="absolute top-1/4 right-8 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-xl"
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div 
              className="absolute bottom-1/4 left-8 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg"
              animate={{ 
                scale: [1.1, 1, 1.1],
                rotate: [360, 180, 0]
              }}
              transition={{ 
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-8 pt-8 border-t border-border"
            >
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <Link href="/app" className="hover:text-primary transition-colors">
                  <span className="flex items-center space-x-1">
                    <span>Zur Demo</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
                <span>• </span>
                <span>14 Tage kostenlos testen • Keine Kreditkarte erforderlich</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Signup Form */}
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
                  <GradientText>Starten Sie mit ARAS AI</GradientText>
                </h1>
                <p className="text-muted-foreground">
                  Erstellen Sie Ihr Konto für die KI-Outbound-Telefonie-Plattform
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input 
                      id="firstName" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ihr Vorname"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input 
                      id="lastName" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ihr Nachname"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ihre geschäftliche E-Mail-Adresse"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 170 1234567"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mindestens 8 Zeichen"
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
                    </Button>
                  </div>
                  
                  {/* Password Requirements */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      {passwordRequirements.map((req, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs">
                          <Check 
                            className={`w-3 h-3 ${req.met ? 'text-green-500' : 'text-muted-foreground'}`} 
                          />
                          <span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
                            {req.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:text-primary/80">
                      Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:text-primary/80">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
                
                <GlowButton type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Konto wird erstellt...</span>
                    </div>
                  ) : (
                    "Kostenlos testen"
                  )}
                </GlowButton>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-muted-foreground">
                  Bereits ARAS AI Nutzer?{" "}
                  <Link href="/login" className="text-primary hover:text-primary/80 transition-colors">
                    Zur Anmeldung
                  </Link>
                </p>
              </div>

              {/* Mobile Demo Link */}
              <div className="lg:hidden mt-6 pt-6 border-t border-border text-center">
                <Link href="/app" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  <span className="flex items-center justify-center space-x-1">
                    <span>Zur Demo</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}