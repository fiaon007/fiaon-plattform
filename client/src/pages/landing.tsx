import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
import { motion } from "framer-motion";
import { Bot, Users, Phone, Mail } from "lucide-react";

export default function Landing() {
  const [isSignUp, setIsSignUp] = useState(false);

  const features = [
    {
      icon: <Bot className="w-5 h-5" />,
      title: "AI-Powered Voice Agents",
      delay: 0,
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Smart Lead Generation",
      delay: 0.2,
    },
    {
      icon: <Phone className="w-5 h-5" />,
      title: "Automated Campaigns",
      delay: 0.4,
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
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
              The future of AI-powered sales automation
            </motion.div>
            
            <div className="space-y-4 mt-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: feature.delay }}
                  className="bg-card/50 p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow"></div>
                    <span className="text-muted-foreground">{feature.title}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Authentication Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-orbitron font-bold mb-2">
                <GradientText>
                  {isSignUp ? "Join ARAS AI" : "Welcome Back"}
                </GradientText>
              </h1>
              <p className="text-muted-foreground">
                {isSignUp 
                  ? "Create your ARAS AI account" 
                  : "Sign in to your ARAS AI account"
                }
              </p>
            </div>
            
            <div className="space-y-6">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="Enter first name" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Enter last name" />
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter your password" />
              </div>
              
              {isSignUp && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" placeholder="Confirm your password" />
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm">
                    {isSignUp ? "I agree to the terms" : "Remember me"}
                  </Label>
                </div>
                {!isSignUp && (
                  <Button variant="link" className="p-0 h-auto text-primary">
                    Forgot password?
                  </Button>
                )}
              </div>
              
              <GlowButton 
                className="w-full"
                onClick={() => window.location.href = "/api/login"}
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </GlowButton>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
