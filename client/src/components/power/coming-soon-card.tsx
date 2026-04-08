import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { motion } from "framer-motion";

export function ComingSoonCard() {
  const features = [
    "AI Lead Generation",
    "Smart Decision-Maker Finder",
    "Automated Call Campaigns",
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-orange-400/10"></div>
      <div className="relative z-10">
        <CardHeader>
          <CardTitle>
            <GradientText>ARAS Mailing</GradientText>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center space-x-3"
              >
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow"></div>
                <span className="text-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Soon, ARAS AI will allow you to generate leads directly. Just define your target group – our system finds the right decision-makers and calls them automatically.
            </p>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
