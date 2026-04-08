import React from 'react';
import { motion } from "framer-motion";
import { Activity, Play, Zap, Brain, Shield } from 'lucide-react';
import { CI } from '@/lib/constants';

interface CommandHeaderProps {
  animatedStats: {
    calls: number;
    appointments: number;
    followUps: number;
    pipeline: number;
  };
  autoPilotActive: boolean;
  setAutoPilotActive: (active: boolean) => void;
}

export function CommandHeader({ animatedStats, autoPilotActive, setAutoPilotActive }: CommandHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <motion.h1 
          className="text-4xl font-black text-white" 
          style={{ fontFamily: 'Orbitron, sans-serif' }}
          animate={{ 
            textShadow: [
              '0 0 10px rgba(254, 145, 0, 0.5)',
              '0 0 20px rgba(254, 145, 0, 0.8)',
              '0 0 10px rgba(254, 145, 0, 0.5)'
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ARAS AI COMMAND CENTER
        </motion.h1>
        
        {/* Live Status Indicator */}
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ 
            background: 'rgba(254, 145, 0, 0.15)', 
            border: '2px solid rgba(254, 145, 0, 0.4)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <motion.div 
            className="w-3 h-3 rounded-full bg-green-500"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-sm text-white font-bold">LIVE</span>
          <span className="text-sm font-bold" style={{ color: CI.goldLight }}>
            {animatedStats.calls.toLocaleString()} Calls
          </span>
        </motion.div>

        {/* AI Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="flex items-center gap-2 px-3 py-1 rounded-lg"
          style={{ 
            background: 'rgba(147, 51, 234, 0.1)', 
            border: '1px solid rgba(147, 51, 234, 0.3)' 
          }}
        >
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-purple-300">ARIA AKTIV</span>
        </motion.div>
      </div>

      {/* Auto-Pilot Control */}
      <div className="flex items-center gap-3">
        {/* Shield Mode */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
          title="Schutz-Modus"
        >
          <Shield className="w-5 h-5 text-gray-400" />
        </motion.button>

        {/* Auto-Pilot Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setAutoPilotActive(!autoPilotActive)}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-3 ${
            autoPilotActive ? 'text-black' : 'text-white'
          }`}
          style={{
            background: autoPilotActive 
              ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`
              : 'rgba(255,255,255,0.1)',
            border: `2px solid ${autoPilotActive ? CI.orange : 'rgba(255,255,255,0.2)'}`,
            boxShadow: autoPilotActive ? `0 0 40px ${CI.orange}60` : 'none'
          }}
        >
          {autoPilotActive ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Activity className="w-5 h-5" />
              </motion.div>
              <span>AUTO-PILOT AKTIV</span>
              <motion.div
                className="w-2 h-2 rounded-full bg-black"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              <span>AUTO-PILOT STARTEN</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
