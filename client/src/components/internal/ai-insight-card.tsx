/**
 * ============================================================================
 * ARAS AI INSIGHT CARD - Executive Cards for AI Responses
 * ============================================================================
 * Renders AI insights in a premium 3-card layout
 * All UI text uses "ARAS AI" branding (never provider names)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, ListChecks, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface AIInsightData {
  summary?: string;
  risks?: string[];
  nextActions?: string[];
}

interface AIInsightCardProps {
  data: AIInsightData | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onVoicePlay?: (text: string) => void;
  voiceEnabled?: boolean;
  title?: string;
}

export function AIInsightSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 bg-white/10 rounded w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-white/10 rounded w-full" />
              <div className="h-3 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AIErrorCard({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">ARAS AI ist vorübergehend nicht verfügbar</span>
          </div>
          <p className="text-sm text-red-400/70 mb-4">{message}</p>
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Erneut versuchen
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AIInsightCard({
  data,
  isLoading,
  error,
  onRetry,
  onVoicePlay,
  voiceEnabled = false,
  title = "ARAS AI Insights"
}: AIInsightCardProps) {
  const [playingSection, setPlayingSection] = useState<string | null>(null);

  if (isLoading) {
    return <AIInsightSkeleton />;
  }

  if (error) {
    return <AIErrorCard message={error} onRetry={onRetry} />;
  }

  if (!data) {
    return null;
  }

  const handleVoicePlay = (section: string, text: string) => {
    if (onVoicePlay) {
      setPlayingSection(playingSection === section ? null : section);
      onVoicePlay(text);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.2, ease: [0.4, 0, 0.2, 1] }
    })
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {data.summary && (
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  Zusammenfassung
                </span>
                {voiceEnabled && onVoicePlay && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVoicePlay('summary', data.summary!)}
                    className="h-7 px-2"
                  >
                    {playingSection === 'summary' ? (
                      <VolumeX className="w-4 h-4 text-orange-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 text-sm leading-relaxed">{data.summary}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Risks Card */}
      {data.risks && data.risks.length > 0 && (
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Risiken & Bedenken
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.risks.map((risk, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Next Actions Card */}
      {data.nextActions && data.nextActions.length > 0 && (
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-green-400" />
                Nächste Schritte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {data.nextActions.map((action, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-green-400 font-medium min-w-[20px]">{i + 1}.</span>
                    {action}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-500 text-center pt-2">
        Generiert von ARAS AI • Alle Daten bleiben vertraulich
      </p>
    </div>
  );
}

export default AIInsightCard;
