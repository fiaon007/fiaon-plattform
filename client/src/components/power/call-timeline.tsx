import React from 'react';
import { motion } from 'framer-motion';

const CI = {
  goldLight: '#E9D7C4',
  orange: '#FE9100',
  goldDark: '#A34E00'
};

type CallStatus = 'idle' | 'processing' | 'ringing' | 'connected' | 'ended';

interface TimelineStep {
  id: CallStatus;
  label: string;
  description: string;
}

interface CallTimelineProps {
  currentStatus: CallStatus;
  duration?: number;
}

const steps: TimelineStep[] = [
  {
    id: 'processing',
    label: 'Vorbereitung',
    description: 'Anruf wird konfiguriert'
  },
  {
    id: 'ringing',
    label: 'Verbindung',
    description: 'Nummer wird gewählt'
  },
  {
    id: 'connected',
    label: 'Gespräch',
    description: 'ARAS spricht'
  },
  {
    id: 'ended',
    label: 'Abgeschlossen',
    description: 'Transkript & Zusammenfassung'
  }
];

export function CallTimeline({ currentStatus, duration = 0 }: CallTimelineProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStatus);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const isPending = index > currentIndex;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-start gap-3.5"
          >
            {/* Node Circle */}
            <div className="relative flex-shrink-0">
              {/* Main Node */}
              <motion.div
                className="relative z-10 rounded-full flex items-center justify-center"
                style={{
                  width: isActive ? '16px' : '12px',
                  height: isActive ? '16px' : '12px',
                  background: isActive
                    ? 'rgba(254,145,0,0.85)'
                    : isCompleted
                    ? 'rgba(233,215,196,0.7)'
                    : 'rgba(255,255,255,0.12)',
                  border: isActive
                    ? '2px solid rgba(254,145,0,1)'
                    : isCompleted
                    ? '1px solid rgba(233,215,196,0.6)'
                    : '1px solid rgba(255,255,255,0.18)',
                  transition: 'all 0.3s ease'
                }}
                animate={isActive ? {
                  boxShadow: [
                    '0 0 0 0 rgba(254,145,0,0.7)',
                    '0 0 16px 2px rgba(254,145,0,0.4)',
                    '0 0 0 0 rgba(254,145,0,0.7)'
                  ]
                } : {}}
                transition={{
                  duration: 2,
                  repeat: isActive ? Infinity : 0,
                  ease: 'easeInOut'
                }}
              >
                {/* Inner Dot for Active */}
                {isActive && (
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-white"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.8, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                )}
              </motion.div>

              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: isActive ? '16px' : '12px',
                    width: '2px',
                    height: '24px',
                    background: isCompleted
                      ? 'linear-gradient(180deg, rgba(233,215,196,0.5), rgba(233,215,196,0.16))'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: isCompleted
                      ? '0 0 6px rgba(233,215,196,0.3)'
                      : 'none'
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <div className="flex items-center justify-between mb-0.5">
                <h4
                  className="text-[15px] font-semibold"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    color: isActive ? CI.orange : isCompleted ? CI.goldLight : '#9ca3af',
                    animation: isActive ? 'aras-pulse 2s ease-in-out infinite' : 'none'
                  }}
                >
                  {step.label}
                </h4>

                {isActive && currentStatus === 'connected' && duration > 0 && (
                  <motion.span
                    className="text-[11px] font-mono px-2 py-0.5 rounded-lg font-semibold"
                    style={{
                      background: 'rgba(34,197,94,0.12)',
                      color: '#4ade80',
                      border: '1px solid rgba(34,197,94,0.25)'
                    }}
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {formatDuration(duration)}
                  </motion.span>
                )}
                {isActive && currentStatus === 'ended' && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: 'rgba(233,215,196,0.15)',
                      color: CI.goldLight,
                      border: '1px solid rgba(233,215,196,0.3)'
                    }}
                  >
                    Fertig
                  </span>
                )}
              </div>

              <p
                className="text-[13px] leading-relaxed"
                style={{
                  color: isActive ? '#d1d5db' : isCompleted ? '#a8a8a8' : '#6b7280'
                }}
              >
                {step.description}
              </p>

              {/* Active Step Extra Info */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2"
                >
                  <div
                    className="px-2.5 py-1.5 rounded-lg text-[11px]"
                    style={{
                      background: 'rgba(254,145,0,0.06)',
                      border: '1px solid rgba(254,145,0,0.18)',
                      color: '#e5e7eb'
                    }}
                  >
                    {currentStatus === 'processing' && 'KI optimiert Gesprächsführung'}
                    {currentStatus === 'ringing' && 'Verbindung wird aufgebaut'}
                    {currentStatus === 'connected' && 'ARAS führt das Gespräch'}
                    {currentStatus === 'ended' && 'Transkript & Summary werden erstellt'}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
