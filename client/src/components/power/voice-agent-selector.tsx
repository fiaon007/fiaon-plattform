import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GradientText } from "@/components/ui/gradient-text";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";

interface VoiceAgentSelectorProps {
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
}

export function VoiceAgentSelector({ selectedAgent, onAgentChange }: VoiceAgentSelectorProps) {
  // Use demo data for prototype
  const voiceAgents = [
    {
      id: "1",
      name: "Alex - Professional",
      description: "Clear, confident voice perfect for B2B sales",
      voice: "professional",
      language: "en-US",
      gender: "male"
    },
    {
      id: "2",
      name: "Sarah - Friendly",
      description: "Warm, approachable tone for relationship building",
      voice: "friendly",
      language: "en-US",
      gender: "female"
    },
    {
      id: "3",
      name: "David - Authoritative",
      description: "Strong, persuasive voice for executive outreach",
      voice: "authoritative",
      language: "en-US",
      gender: "male"
    }
  ];
  const isLoading = false;

  const defaultAgents = [
    {
      id: "1",
      name: "Alex - Professional",
      description: "Clear, confident voice",
      voice: "professional",
    },
    {
      id: "2",
      name: "Sarah - Friendly",
      description: "Warm, approachable tone",
      voice: "friendly",
    },
    {
      id: "3",
      name: "David - Authoritative",
      description: "Strong, persuasive voice",
      voice: "authoritative",
    },
  ];

  const agents = voiceAgents.length > 0 ? voiceAgents : defaultAgents;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <GradientText>Voice Agent</GradientText>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <GradientText>Voice Agent</GradientText>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedAgent} onValueChange={onAgentChange}>
          <div className="space-y-3">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Label
                  htmlFor={agent.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedAgent === agent.id
                      ? "bg-primary/10 border border-primary"
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={selectedAgent === agent.id ? "bg-primary" : "bg-muted"}>
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.description}
                    </div>
                  </div>
                  <RadioGroupItem value={agent.id} id={agent.id} />
                </Label>
              </motion.div>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
