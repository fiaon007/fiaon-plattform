import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, Mail, Calendar, FileText, MessageCircle, X, 
  TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle,
  User, Building, DollarSign, Target, ChevronRight
} from 'lucide-react';
import { CI } from '@/lib/constants';

interface LeadStoryProps {
  lead: any;
  onClose: () => void;
}

export function LeadStory({ lead, onClose }: LeadStoryProps) {
  const timeline = [
    {
      date: '3.12.',
      type: 'call',
      icon: Phone,
      title: 'Erster Anruf',
      description: '"Kein Interesse momentan"',
      insight: 'Timing schlecht, Q1 nochmal versuchen',
      sentiment: 'neutral',
      score: 3
    },
    {
      date: '10.12.',
      type: 'email',
      icon: Mail,
      title: 'Follow-Up Email',
      description: 'Geöffnet 3x, Link geklickt',
      insight: 'Interesse steigt!',
      sentiment: 'positive',
      score: 5
    },
    {
      date: '17.12.',
      type: 'call',
      icon: Phone,
      title: 'Zweiter Anruf',
      description: '"Interessant, aber Budget knapp"',
      insight: 'Preiseinwand → ROI-Fokus',
      sentiment: 'neutral',
      score: 6
    },
    {
      date: '18.12.',
      type: 'document',
      icon: FileText,
      title: 'Case Study gesendet',
      description: 'PDF 12 Minuten gelesen',
      insight: 'HOT! Jetzt Demo anbieten',
      sentiment: 'positive',
      score: 8
    },
    {
      date: 'Morgen',
      type: 'meeting',
      icon: Calendar,
      title: 'Demo-Call geplant',
      description: '14:00 Uhr, CFO dabei',
      insight: 'ROI-Rechner vorbereiten!',
      sentiment: 'upcoming',
      score: 9
    }
  ];

  const getColorByType = (type: string) => {
    const colors: { [key: string]: string } = {
      call: CI.orange,
      email: '#3b82f6',
      document: CI.goldLight,
      meeting: '#10b981',
      message: '#8b5cf6'
    };
    return colors[type] || '#6b7280';
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'positive') return TrendingUp;
    if (sentiment === 'negative') return TrendingDown;
    if (sentiment === 'upcoming') return Clock;
    return AlertCircle;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
          border: '2px solid rgba(254, 145, 0, 0.2)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Lead Score */}
              <motion.div
                className="w-16 h-16 rounded-xl flex flex-col items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}30, ${CI.orange}10)`,
                  border: `2px solid ${CI.orange}60`
                }}
                animate={{ 
                  boxShadow: [
                    `0 0 20px ${CI.orange}40`,
                    `0 0 40px ${CI.orange}60`,
                    `0 0 20px ${CI.orange}40`
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-2xl font-black" style={{ color: CI.orange }}>
                  {lead.score || 9}
                </span>
                <span className="text-xs opacity-70">Score</span>
              </motion.div>

              {/* Lead Info */}
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {lead.name} STORY
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {lead.company || 'TechCorp GmbH'}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {lead.value}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {lead.stage}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>KALT</span>
              <span>HEIß</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldLight})`,
                  boxShadow: `0 0 10px ${CI.orange}60`
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${(lead.score || 9) * 10}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-orange-500/50 to-transparent" />
            
            {/* Timeline Events */}
            <div className="space-y-4">
              {timeline.map((event, idx) => {
                const Icon = event.icon;
                const SentimentIcon = getSentimentIcon(event.sentiment);
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4 group"
                  >
                    {/* Icon */}
                    <motion.div
                      className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                      style={{
                        background: `${getColorByType(event.type)}20`,
                        border: `1px solid ${getColorByType(event.type)}40`
                      }}
                      whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    >
                      <Icon className="w-6 h-6" style={{ color: getColorByType(event.type) }} />
                      
                      {/* Score Badge */}
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ 
                          background: CI.black,
                          border: `1px solid ${getColorByType(event.type)}`,
                          color: getColorByType(event.type)
                        }}
                      >
                        {event.score}
                      </div>
                    </motion.div>

                    {/* Content */}
                    <motion.div
                      className="flex-1 bg-white/5 rounded-xl p-4 group-hover:bg-white/8 transition-colors"
                      whileHover={{ x: 5 }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400">{event.date}</span>
                          <span className="text-sm font-bold text-white">{event.title}</span>
                          {event.sentiment && (
                            <SentimentIcon className="w-4 h-4" style={{ 
                              color: event.sentiment === 'positive' ? '#10b981' : 
                                     event.sentiment === 'negative' ? '#ef4444' : 
                                     event.sentiment === 'upcoming' ? CI.goldLight : '#6b7280'
                            }} />
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-300 mb-2">{event.description}</p>

                      {/* AI Insight */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{
                          background: 'rgba(254, 145, 0, 0.1)',
                          border: '1px solid rgba(254, 145, 0, 0.2)'
                        }}
                      >
                        <span className="text-xs">→ AI:</span>
                        <span className="text-xs font-medium" style={{ color: CI.goldLight }}>
                          {event.insight}
                        </span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Next Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-6 p-4 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-bold text-white">NÄCHSTE AKTION</span>
                </div>
                <p className="text-sm text-gray-300">
                  Demo-Call morgen 14 Uhr • ROI-Rechner vorbereiten • CFO ist dabei!
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2"
                style={{
                  background: CI.orange,
                  color: 'black'
                }}
              >
                VORBEREITEN
                <ChevronRight className="w-3 h-3" />
              </motion.button>
            </div>
          </motion.div>

          {/* Prediction */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-4 text-center"
          >
            <div className="text-xs text-gray-500 mb-1">KI-VORHERSAGE</div>
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-lg font-bold text-green-400">
                {lead.chance || 95}% Abschluss-Wahrscheinlichkeit
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
