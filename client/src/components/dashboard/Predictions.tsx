import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, AlertCircle, Trophy, Target, Brain, Zap, 
  DollarSign, Clock, ChevronRight, Sparkles, AlertTriangle,
  CheckCircle, Calendar, TrendingDown, RefreshCw
} from 'lucide-react';
import { CI } from '@/lib/constants';

export function Predictions() {
  const [currentPrediction, setCurrentPrediction] = useState(0);
  
  const predictions = [
    { 
      type: 'success', 
      icon: TrendingUp,
      title: 'Deal Closing',
      text: "TechCorp wird zu 95% am Freitag abschließen",
      value: "€50,000",
      confidence: 95,
      timeframe: "in 3 Tagen",
      action: "Vertrag vorbereiten"
    },
    { 
      type: 'success', 
      icon: Trophy,
      title: 'Hot Lead',
      text: "Digital AG wird zu 88% am Montag zusagen",
      value: "€35,000",
      confidence: 88,
      timeframe: "in 5 Tagen",
      action: "Demo-Follow-Up"
    },
    { 
      type: 'warning', 
      icon: AlertTriangle,
      title: 'Kalter Lead',
      text: "BMW Group wird kalt - letzter Kontakt vor 12 Tagen!",
      value: "€120,000 gefährdet",
      confidence: 78,
      timeframe: "JETZT handeln",
      action: "Reaktivierungs-Kampagne"
    },
    { 
      type: 'warning', 
      icon: RefreshCw,
      title: 'Strategie ändern',
      text: "Siemens hat 3 Emails ignoriert",
      value: "€85,000 Potential",
      confidence: 65,
      timeframe: "Alternative nötig",
      action: "Auf WhatsApp wechseln"
    }
  ];

  const opportunities = [
    {
      icon: DollarSign,
      title: "Dezember-Special pushen",
      reason: "73% erwähnten Budget-Themen",
      impact: "+€250k Potential",
      urgency: "high"
    },
    {
      icon: Clock,
      title: "Beste Call-Zeit nutzen",
      reason: "14-16 Uhr = 67% Erfolg",
      impact: "+12% Conversion",
      urgency: "medium"
    },
    {
      icon: Target,
      title: "Enterprise-Fokus",
      reason: "3x höhere Deal-Größe",
      impact: "+€180k Pipeline",
      urgency: "high"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrediction((prev) => (prev + 1) % predictions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [predictions.length]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10b981';
    if (confidence >= 60) return CI.goldLight;
    return '#ef4444';
  };

  return (
    <>
      {/* Predictions Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.05), rgba(254, 145, 0, 0.03))',
          border: '2px solid rgba(147, 51, 234, 0.2)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Brain className="w-5 h-5 text-purple-400" />
              </motion.div>
              <h3 className="font-bold text-white">KI VORHERSAGEN</h3>
            </div>
            <motion.span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                background: 'rgba(147, 51, 234, 0.1)',
                color: '#c084fc',
                border: '1px solid rgba(147, 51, 234, 0.3)'
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              LIVE ANALYSE
            </motion.span>
          </div>
        </div>

        {/* Animated Predictions */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {predictions.map((prediction, idx) => {
              if (idx !== currentPrediction) return null;
              const Icon = prediction.icon;
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-3"
                >
                  {/* Prediction Header */}
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: prediction.type === 'success' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${prediction.type === 'success' ? '#10b981' : '#ef4444'}40`
                      }}
                      whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    >
                      <Icon className="w-5 h-5" style={{ 
                        color: prediction.type === 'success' ? '#10b981' : '#ef4444' 
                      }} />
                    </motion.div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{
                          color: prediction.type === 'success' ? '#10b981' : '#ef4444'
                        }}>
                          {prediction.title.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">• {prediction.timeframe}</span>
                      </div>
                      <p className="text-sm text-white font-medium">{prediction.text}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <div className="text-xs text-gray-500 mb-0.5">Wert</div>
                      <div className="text-lg font-bold" style={{ color: CI.goldLight }}>
                        {prediction.value}
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <div className="text-xs text-gray-500 mb-0.5">Konfidenz</div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold" style={{ 
                          color: getConfidenceColor(prediction.confidence) 
                        }}>
                          {prediction.confidence}%
                        </div>
                        <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: getConfidenceColor(prediction.confidence) }}
                            initial={{ width: '0%' }}
                            animate={{ width: `${prediction.confidence}%` }}
                            transition={{ duration: 1 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full p-3 rounded-lg flex items-center justify-between group"
                    style={{
                      background: prediction.type === 'success' 
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(254, 145, 0, 0.1)',
                      border: `1px solid ${prediction.type === 'success' ? '#10b981' : CI.orange}30`
                    }}
                  >
                    <span className="text-xs font-bold text-white">
                      {prediction.action}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Prediction Dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {predictions.map((_, idx) => (
              <motion.div
                key={idx}
                className="w-1.5 h-1.5 rounded-full cursor-pointer"
                onClick={() => setCurrentPrediction(idx)}
                animate={{
                  backgroundColor: idx === currentPrediction ? CI.orange : 'rgba(255,255,255,0.2)',
                  scale: idx === currentPrediction ? 1.5 : 1
                }}
                whileHover={{ scale: 1.8 }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Opportunities Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.05), rgba(233, 215, 196, 0.03))',
          border: '2px solid rgba(254, 145, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" style={{ color: CI.orange }} />
            <h3 className="font-bold text-white">OPPORTUNITIES</h3>
          </div>
        </div>

        {/* Opportunities List */}
        <div className="p-4 space-y-3">
          {opportunities.map((opp, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              whileHover={{ x: 5 }}
              className="rounded-lg p-3 cursor-pointer group"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(254, 145, 0, 0.1)',
                    border: '1px solid rgba(254, 145, 0, 0.3)'
                  }}
                >
                  <opp.icon className="w-4 h-4" style={{ color: CI.orange }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">{opp.title}</span>
                    {opp.urgency === 'high' && (
                      <motion.span
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium"
                      >
                        URGENT
                      </motion.span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{opp.reason}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: CI.goldLight }}>
                      {opp.impact}
                    </span>
                    <ChevronRight className="w-3 h-3 text-gray-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Start Campaign Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
              color: 'black'
            }}
          >
            <Zap className="w-4 h-4" />
            KAMPAGNE STARTEN
          </motion.button>
        </div>
      </motion.div>

      {/* Forecast Mini Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl p-4"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-400">Q1 2025 FORECAST</span>
          <Calendar className="w-4 h-4 text-gray-500" />
        </div>
        <div className="text-2xl font-black text-white mb-1">€580,000</div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400">+23% vs. Q4</span>
        </div>
        <div className="mt-3 h-1 bg-black/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldLight})` }}
            initial={{ width: '0%' }}
            animate={{ width: '68%' }}
            transition={{ duration: 2, delay: 0.5 }}
          />
        </div>
      </motion.div>
    </>
  );
}
