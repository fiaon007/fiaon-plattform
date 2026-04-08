import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RotateCcw } from 'lucide-react';

const CI = {
  goldLight: '#E9D7C4',
  orange: '#FE9100',
  goldDark: '#A34E00'
};

interface CallErrorCardProps {
  error: string;
  onRetry: () => void;
  onBack?: () => void;
}

export function CallErrorCard({ error, onRetry, onBack }: CallErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(185,28,28,0.08))',
        border: '1px solid rgba(239,68,68,0.3)',
        backdropFilter: 'blur(16px)'
      }}
    >
      <div className="text-center">
        <div 
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid rgba(239,68,68,0.4)'
          }}
        >
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        
        <h3 
          className="text-lg font-bold mb-2"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            color: '#fca5a5'
          }}
        >
          Anruf konnte nicht gestartet werden
        </h3>
        
        <p className="text-sm text-red-200/80 mb-6 leading-relaxed">
          {error || 'Es ist ein unerwarteter Fehler aufgetreten. Bitte prüfe deine Eingaben oder versuche es später erneut.'}
        </p>
        
        <div className="flex gap-3 justify-center">
          {onBack && (
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff'
              }}
            >
              Zurück zum Auftrag
            </button>
          )}
          
          <button
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
              color: '#fff',
              fontFamily: 'Orbitron, sans-serif'
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Erneut versuchen
          </button>
        </div>
      </div>
    </motion.div>
  );
}
