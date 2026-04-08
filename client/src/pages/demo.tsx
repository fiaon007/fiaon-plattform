import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
import { MessageBubble } from "@/components/chat/message-bubble";
import { motion } from "framer-motion";
import { Bot, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

export default function Demo() {
  const [demoInput, setDemoInput] = useState("");
  const [showDemoResponse, setShowDemoResponse] = useState(false);

  const handleDemo = () => {
    if (demoInput.trim()) {
      setShowDemoResponse(true);
    }
  };

  const demoMessages = [
    {
      id: 1,
      message: "Research Company XY and find their decision makers",
      isAi: false,
      timestamp: new Date(),
    },
    {
      id: 2,
      message: "I've found Company XY's key decision makers:",
      isAi: true,
      timestamp: new Date(),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-8">
            <img 
              src={arasLogo} 
              alt="ARAS AI" 
              className="w-32 h-32 md:w-40 md:h-40"
            />
          </div>
          <h1 className="text-3xl md:text-5xl font-orbitron font-bold mb-4">
            <GradientText>AI-Powered Sales Platform</GradientText>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the future of AI-powered sales automation
          </p>
        </motion.div>
        
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardContent className="p-8">
              <h2 className="text-2xl font-orbitron font-bold mb-6">
                <GradientText>Try ARAS AI</GradientText>
              </h2>
              
              {/* Demo Chat Interface */}
              <div className="bg-secondary rounded-lg p-6 mb-6">
                <div className="space-y-4">
                  {demoMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg.message}
                      isAi={msg.isAi}
                      timestamp={msg.timestamp}
                    />
                  ))}
                  
                  {showDemoResponse && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="flex"
                    >
                      <div className="max-w-md bg-card p-4 rounded-lg rounded-tl-none border border-border">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-primary to-orange-400 rounded-full flex items-center justify-center">
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-medium text-primary">ARAS AI</span>
                        </div>
                        <p className="text-foreground mb-3">
                          Based on your input "{demoInput}", I would analyze company data and provide:
                        </p>
                        <div className="space-y-2">
                          <div className="bg-secondary p-3 rounded-lg">
                            <p className="font-medium">John Smith - CEO</p>
                            <p className="text-sm text-muted-foreground">john.smith@company.com</p>
                          </div>
                          <div className="bg-secondary p-3 rounded-lg">
                            <p className="font-medium">Sarah Johnson - CTO</p>
                            <p className="text-sm text-muted-foreground">sarah.johnson@company.com</p>
                          </div>
                        </div>
                        <div className="mt-3 flex space-x-2">
                          <Button size="sm" variant="outline">
                            Schedule Calls
                          </Button>
                          <Button size="sm" variant="outline">
                            Send Emails
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              
              {/* Demo Input */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    value={demoInput}
                    onChange={(e) => setDemoInput(e.target.value)}
                    placeholder="Try: 'Find leads in the tech industry' or 'Schedule follow-up calls'"
                    onKeyPress={(e) => e.key === 'Enter' && handleDemo()}
                  />
                </div>
                <GlowButton onClick={handleDemo}>
                  Try Demo
                </GlowButton>
              </div>
            </CardContent>
          </Card>
          
          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center"
          >
            <h3 className="text-2xl font-orbitron font-bold mb-4">
              <GradientText>Ready to Transform Your Sales Process?</GradientText>
            </h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of sales professionals using ARAS AI to automate their outreach and close more deals.
            </p>
            <div className="flex justify-center space-x-4">
              <GlowButton asChild>
                <Link href="/">
                  <span className="flex items-center space-x-2">
                    <span>Start Free Trial</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </GlowButton>
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
