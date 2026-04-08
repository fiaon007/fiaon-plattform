import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check, Zap, TrendingUp, Target } from 'lucide-react';
import { CI } from '@/lib/constants';

interface DemoModalProps {
  onClose: () => void;
}

export function DemoModal({ onClose }: DemoModalProps) {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Insights",
      description: "Echtzeit-Analyse von 10.847+ Calls"
    },
    {
      icon: Zap,
      title: "Auto-Pilot Modus",
      description: "Automatisierte Follow-Ups & Termine"
    },
    {
      icon: TrendingUp,
      title: "Predictive Analytics",
      description: "Vorhersagen mit 94% Genauigkeit"
    },
    {
      icon: Target,
      title: "Smart Lead Scoring",
      description: "Intelligente Priorisierung Ihrer Leads"
    }
  ];

  useEffect(() => {
    if (step < features.length) {
      const timer = setTimeout(() => setStep(step + 1), 600);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleAccept = () => {
    setAccepted(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ 
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Animated Background Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: i % 2 === 0 ? CI.orange : CI.goldLight,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0]
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ 
            scale: accepted ? 0.95 : 1, 
            opacity: 1, 
            y: 0 
          }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-2xl w-full rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1) 0%, rgba(10, 10, 10, 0.95) 100%)',
            border: `2px solid ${CI.orange}40`,
            boxShadow: `0 0 60px ${CI.orange}30, inset 0 0 40px rgba(254, 145, 0, 0.05)`
          }}
        >
          {/* Glow Effect */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 0%, ${CI.orange}, transparent 70%)`
            }}
          />

          {/* Content */}
          <div className="relative p-8 md:p-12">
            {/* Header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="inline-block mb-4"
              >
                <div 
                  className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    boxShadow: `0 10px 40px ${CI.orange}50`
                  }}
                >
                  <Sparkles className="w-10 h-10 text-black" strokeWidth={2.5} />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-5xl font-black mb-3"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: `0 0 40px ${CI.orange}30`
                }}
              >
                DEMO MODE
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-gray-300 text-lg"
              >
                ARAS AI Command Center
              </motion.p>
            </motion.div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ 
                    opacity: step > index ? 1 : 0,
                    x: step > index ? 0 : (index % 2 === 0 ? -20 : 20)
                  }}
                  transition={{ delay: index * 0.1 }}
                  className="relative p-4 rounded-xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${step > index ? CI.orange : 'rgba(255, 255, 255, 0.1)'}40`,
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <motion.div
                      animate={step > index ? {
                        rotate: [0, 360],
                        scale: [1, 1.2, 1]
                      } : {}}
                      transition={{ duration: 0.6 }}
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${CI.orange}20, ${CI.goldDark}20)`,
                        border: `1px solid ${CI.orange}40`
                      }}
                    >
                      <feature.icon 
                        className="w-5 h-5" 
                        style={{ color: CI.orange }}
                      />
                    </motion.div>
                    <div className="flex-1">
                      <h3 
                        className="font-bold text-sm mb-1"
                        style={{ color: CI.goldLight }}
                      >
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="p-6 rounded-2xl mb-6"
              style={{
                background: 'rgba(254, 145, 0, 0.05)',
                border: `1px solid ${CI.orange}30`,
                backdropFilter: 'blur(20px)'
              }}
            >
              <p className="text-gray-300 text-sm leading-relaxed text-center">
                Dies ist eine <span className="font-bold" style={{ color: CI.orange }}>DEMO-Version</span> des 
                ARAS AI Command Centers. Alle angezeigten Daten sind <span className="font-bold">simuliert</span> und 
                dienen ausschließlich zu <span className="font-bold">Demonstrationszwecken</span>.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAccept}
                className="flex-1 py-4 px-6 rounded-xl font-bold text-black relative overflow-hidden group"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                  boxShadow: `0 10px 30px ${CI.orange}40`
                }}
              >
                {/* Shine Effect */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'
                  }}
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                />
                
                <span className="relative flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  DEMO STARTEN
                </span>
              </motion.button>
            </div>

            {/* Version Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center mt-6"
            >
              <span className="text-xs text-gray-500 font-mono">
                Version 2.0 REVOLUTION • Powered by ARAS AI
              </span>
            </motion.div>
          </div>

          {/* Animated Border */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, ${CI.orange}40, transparent)`,
              opacity: 0.5
            }}
            animate={{
              rotate: [0, 360]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </motion.div>

        {/* Font Import */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" 
          rel="stylesheet" 
        />
      </motion.div>
    </AnimatePresence>
  );
}
