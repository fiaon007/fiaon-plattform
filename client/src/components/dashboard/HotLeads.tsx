import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Mail, Check, Clock, Pause, Phone, TrendingUp, AlertTriangle } from 'lucide-react';
import { CI } from '@/lib/constants';

interface Lead {
  id: number;
  name: string;
  company: string;
  time: string;
  message: string;
  action: 'auto-email' | 'calendar' | 'reminder' | 'callback';
  score: number;
  value: string;
  phone?: string;
  email?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface HotLeadsProps {
  onSelectLead: (lead: Lead) => void;
}

export function HotLeads({ onSelectLead }: HotLeadsProps) {
  const [pausedEmails, setPausedEmails] = useState<number[]>([]);
  
  const hotLeads: Lead[] = [
    { 
      id: 1, 
      name: "Anna Schmidt", 
      company: "TechStart GmbH",
      time: "vor 5 Min", 
      message: "Ja, schicken Sie das Angebot sofort!", 
      action: "auto-email",
      score: 9,
      value: "€15,000",
      sentiment: 'positive',
      email: "anna@techstart.de"
    },
    { 
      id: 2, 
      name: "Max Müller", 
      company: "Digital Solutions AG",
      time: "vor 12 Min", 
      message: "Termin morgen 14 Uhr passt perfekt", 
      action: "calendar",
      score: 8,
      value: "€25,000",
      sentiment: 'positive'
    },
    { 
      id: 3, 
      name: "Lisa Weber", 
      company: "Innovation Labs",
      time: "vor 23 Min", 
      message: "Rufen Sie in 1 Woche zurück", 
      action: "reminder",
      score: 6,
      value: "€8,500",
      sentiment: 'neutral'
    },
    { 
      id: 4, 
      name: "Thomas Klein", 
      company: "Future Tech Corp",
      time: "vor 28 Min", 
      message: "Budget ist freigegeben, los geht's!", 
      action: "callback",
      score: 10,
      value: "€50,000",
      sentiment: 'positive',
      phone: "+49 170 1234567"
    }
  ];

  const handlePauseEmail = (leadId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPausedEmails([...pausedEmails, leadId]);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch(sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return CI.goldLight;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
      className="glass-orange rounded-3xl overflow-hidden relative glass-transition"
      style={{
        boxShadow: `0 20px 60px rgba(254, 145, 0, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)`
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <motion.div
          className="absolute top-0 left-0 w-32 h-32 rounded-full"
          style={{ background: CI.orange }}
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <Flame className="w-7 h-7" style={{ color: CI.orange }} />
            </motion.div>
            <h2 className="text-2xl font-bold text-white">
              {hotLeads.length} HEISSE LEADS - SOFORT HANDELN!
            </h2>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="px-3 py-1 rounded-full text-xs font-bold text-black"
              style={{ background: CI.orange }}
            >
              PRIORITÄT HOCH
            </motion.span>
          </div>
          <motion.div
            className="text-sm text-gray-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Automatik läuft...
          </motion.div>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {hotLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -50, rotateX: -15 }}
                animate={{ opacity: 1, x: 0, rotateX: 0 }}
                exit={{ opacity: 0, x: 50, rotateX: 15 }}
                transition={{ 
                  delay: 0.1 * index,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{ 
                  scale: 1.02,
                  y: -3,
                  transition: { duration: 0.2 }
                }}
                className="glass-card glass-card-hover rounded-2xl p-4 flex items-center justify-between cursor-pointer group"
                style={{
                  border: `1px solid ${CI.orange}25`
                }}
                onClick={() => onSelectLead(lead)}
              >
                <div className="flex items-start gap-4">
                  {/* Score Badge */}
                  <motion.div 
                    className="w-14 h-14 rounded-xl flex flex-col items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}40, ${CI.orange}20)`,
                      border: `2px solid ${CI.orange}60`
                    }}
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                  >
                    <span className="text-xl font-black" style={{ color: CI.orange }}>
                      {lead.score}
                    </span>
                    <span className="text-xs opacity-70">Score</span>
                  </motion.div>

                  {/* Lead Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-white text-lg">{lead.name}</span>
                      <span className="text-sm text-gray-400">• {lead.company}</span>
                      <span className="text-xs text-gray-500">• {lead.time}</span>
                      {lead.sentiment && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getSentimentColor(lead.sentiment) }}
                        />
                      )}
                    </div>
                    <p className="text-sm text-gray-300 italic mb-2">"{lead.message}"</p>
                    
                    {/* Action Status */}
                    <div className="flex items-center gap-4">
                      {lead.action === 'auto-email' && !pausedEmails.includes(lead.id) && (
                        <motion.div
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex items-center gap-2 text-xs px-3 py-1 rounded-lg"
                          style={{ 
                            background: 'rgba(254, 145, 0, 0.1)',
                            border: '1px solid rgba(254, 145, 0, 0.3)',
                            color: CI.goldLight 
                          }}
                        >
                          <Mail className="w-3 h-3" />
                          <span>AUTO-EMAIL IN 30 SEK</span>
                          <motion.div
                            className="w-1 h-1 rounded-full bg-current"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          />
                        </motion.div>
                      )}
                      
                      {lead.action === 'calendar' && (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <Check className="w-3 h-3" />
                          <span>KALENDER EINGETRAGEN ✓</span>
                        </div>
                      )}
                      
                      {lead.action === 'reminder' && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: CI.goldLight }}>
                          <Clock className="w-3 h-3" />
                          <span>REMINDER GESETZT FÜR 10.12.</span>
                        </div>
                      )}
                      
                      {lead.action === 'callback' && (
                        <motion.div 
                          className="flex items-center gap-2 text-xs text-green-400"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Phone className="w-3 h-3" />
                          <span>RÜCKRUF ERFORDERLICH!</span>
                        </motion.div>
                      )}

                      {/* Additional Info */}
                      {lead.phone && (
                        <span className="text-xs text-gray-500">📞 {lead.phone}</span>
                      )}
                      {lead.email && (
                        <span className="text-xs text-gray-500">✉️ {lead.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Value & Actions */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <motion.div 
                      className="text-2xl font-black"
                      style={{ color: CI.goldLight }}
                      animate={{ 
                        textShadow: lead.score >= 9 
                          ? ['0 0 10px rgba(254, 145, 0, 0.5)', '0 0 20px rgba(254, 145, 0, 0.8)', '0 0 10px rgba(254, 145, 0, 0.5)']
                          : 'none'
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {lead.value}
                    </motion.div>
                    <div className="text-xs text-gray-500">Potential</div>
                    {lead.score >= 9 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1 mt-1"
                      >
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400">HOT!</span>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {lead.action === 'auto-email' && !pausedEmails.includes(lead.id) && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handlePauseEmail(lead.id, e)}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Email stoppen"
                      >
                        <Pause className="w-4 h-4" />
                      </motion.button>
                    )}
                    
                    {lead.action === 'callback' && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Trigger call
                        }}
                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors animate-pulse"
                        title="Jetzt anrufen"
                      >
                        <Phone className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-between mt-4 pt-4 border-t border-white/10"
        >
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Ø Response Zeit: <span className="text-white font-bold">1.2 Min</span></span>
            <span>Erfolgsrate heute: <span className="text-green-400 font-bold">87%</span></span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-xs font-bold px-3 py-1 rounded-lg"
            style={{
              background: 'rgba(254, 145, 0, 0.1)',
              border: '1px solid rgba(254, 145, 0, 0.3)',
              color: CI.orange
            }}
          >
            ALLE ANZEIGEN →
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
