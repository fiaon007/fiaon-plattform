import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, X, AlertCircle, Sparkles, ChevronRight, Clock, Mail, Phone, FileText, MessageCircle, Mic, Calendar } from 'lucide-react';
import { CI } from '@/lib/constants';

export function AriaAssistant() {
  const [showAria, setShowAria] = useState(true);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const messages = [
    "Guten Morgen! Ich habe die gestrigen 2.847 Calls analysiert.",
    "34 Termine wurden automatisch in Ihren Kalender eingetragen.",
    "127 Follow-Up Emails sind vorbereitet und warten auf Freigabe.",
    "12 Verträge wurden als PDF generiert - bereit zum Versand."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages.length]);

  if (!showAria) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setShowAria(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center z-50"
        style={{
          background: 'linear-gradient(135deg, #9333ea, #c084fc)',
          boxShadow: '0 20px 40px rgba(147, 51, 234, 0.4)'
        }}
      >
        <Brain className="w-7 h-7 text-white" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08), rgba(233, 215, 196, 0.03))',
        border: '2px solid rgba(147, 51, 234, 0.25)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)'
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(147, 51, 234, 0.5)',
                  '0 0 40px rgba(147, 51, 234, 0.8)',
                  '0 0 20px rgba(147, 51, 234, 0.5)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #9333ea, #c084fc)' }}
            >
              <Brain className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                ARIA - Ihre AI-Assistentin
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-green-400"
                />
              </h3>
              <p className="text-xs text-gray-400">Proaktive Intelligenz • 24/7 Aktiv</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsListening(!isListening)}
              className={`p-2 rounded-lg transition-all ${
                isListening ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
              }`}
            >
              <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
            </motion.button>
            <button 
              onClick={() => setShowAria(false)} 
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Animated Messages */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="text-sm text-gray-300"
            >
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                <span>{messages[currentMessage]}</span>
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* Stats Summary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-3 gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            {[
              { icon: Phone, label: '2,847', subtext: 'Calls analysiert', color: CI.orange },
              { icon: Calendar, label: '34', subtext: 'Termine eingetragen', color: CI.goldLight },
              { icon: Mail, label: '127', subtext: 'Emails vorbereitet', color: CI.orange }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-2">
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div className="text-2xl font-bold text-white">{item.label}</div>
                <div className="text-xs text-gray-500">{item.subtext}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Important Alert */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="rounded-xl p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
              </motion.div>
              <span className="font-bold text-red-400">DRINGEND</span>
              <span className="text-xs text-gray-400">vor 5 Min</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">
              <strong>TechCorp GmbH</strong> (€50k Deal) wartet auf Rückruf! 
              Sie haben gestern versprochen 'bis 10 Uhr' zurückzurufen.
            </p>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-2"
              >
                <Phone className="w-3 h-3" />
                JETZT ANRUFEN
              </motion.button>
              <button className="px-4 py-2 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20">
                <Clock className="w-3 h-3 inline mr-1" />
                IN 30 MIN
              </button>
              <button className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10">
                SPÄTER
              </button>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-4 rounded-xl text-left group"
              style={{
                background: 'rgba(254, 145, 0, 0.1)',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Mail className="w-5 h-5" style={{ color: CI.orange }} />
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-white">127</div>
              <div className="text-xs text-gray-400">Emails freigeben</div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-4 rounded-xl text-left group"
              style={{
                background: 'rgba(233, 215, 196, 0.1)',
                border: '1px solid rgba(233, 215, 196, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5" style={{ color: CI.goldLight }} />
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-white">12</div>
              <div className="text-xs text-gray-400">Verträge senden</div>
            </motion.button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-black flex items-center justify-center gap-2"
              style={{ background: CI.orange }}
            >
              <Check className="w-4 h-4" />
              ALLE AKTIONEN FREIGEBEN
            </motion.button>
            <button className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20">
              EINZELN PRÜFEN
            </button>
          </div>

          {/* Voice Command Hint */}
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg"
              style={{ background: 'rgba(147, 51, 234, 0.1)' }}
            >
              <Mic className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-xs text-purple-300">
                Sprechen Sie: "Hey ARIA, zeig mir die wichtigsten Leads"
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
