/**
 * ARAS Premium Mark - Custom SVG Icon
 * Swiss hardware aesthetic, minimal, precise
 * No cheap icons - premium brand identity
 */

import React from 'react';
import { motion } from 'framer-motion';

interface ArasMarkProps {
  size?: number;
  className?: string;
  animate?: boolean;
  glow?: boolean;
}

export function ArasMark({ size = 48, className = '', animate = false, glow = true }: ArasMarkProps) {
  const glowFilter = glow ? 'drop-shadow(0 0 8px rgba(255,106,0,0.4)) drop-shadow(0 0 20px rgba(255,106,0,0.2))' : '';
  
  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      initial={animate ? { scale: 0.9, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : false}
      whileHover={animate ? { scale: 1.05 } : undefined}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Outer glow ring */}
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'radial-gradient(circle at center, rgba(255,106,0,0.15) 0%, transparent 70%)',
          }}
          animate={animate ? {
            opacity: [0.5, 0.8, 0.5],
          } : undefined}
          transition={animate ? {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          } : undefined}
        />
      )}
      
      {/* Main SVG Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: glowFilter }}
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="aras-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff6a00" />
            <stop offset="50%" stopColor="#ff8533" />
            <stop offset="100%" stopColor="#e9d7c4" />
          </linearGradient>
          <linearGradient id="aras-dark-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,106,0,0.2)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.8)" />
          </linearGradient>
          <filter id="inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
          </filter>
        </defs>
        
        {/* Outer ring */}
        <circle
          cx="32"
          cy="32"
          r="30"
          stroke="url(#aras-gradient)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        
        {/* Inner filled circle */}
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="url(#aras-dark-gradient)"
          filter="url(#inner-shadow)"
        />
        
        {/* Core circle with gradient */}
        <circle
          cx="32"
          cy="32"
          r="22"
          stroke="url(#aras-gradient)"
          strokeWidth="2"
          fill="rgba(0,0,0,0.6)"
        />
        
        {/* Stylized "A" letterform - precision lines */}
        <path
          d="M32 16 L42 44 M32 16 L22 44 M26 36 L38 36"
          stroke="url(#aras-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Accent dot - center bottom */}
        <circle
          cx="32"
          cy="48"
          r="2"
          fill="#ff6a00"
        />
        
        {/* Scan line animation overlay */}
        {animate && (
          <motion.rect
            x="6"
            y="0"
            width="52"
            height="2"
            fill="url(#aras-gradient)"
            opacity="0.3"
            initial={{ y: 0 }}
            animate={{ y: 64 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </svg>
      
      {/* Hover scan line effect */}
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
        initial={false}
        whileHover={{
          opacity: 1,
        }}
        style={{ opacity: 0 }}
      >
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent"
          initial={{ top: 0 }}
          whileHover={{
            top: ['0%', '100%'],
            transition: { duration: 0.8, ease: 'easeInOut' },
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// Compact version for inline use
export function ArasMarkCompact({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 4px rgba(255,106,0,0.3))' }}
    >
      <defs>
        <linearGradient id="aras-compact-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#e9d7c4" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#aras-compact-gradient)" strokeWidth="1.5" fill="rgba(0,0,0,0.4)" />
      <path d="M12 6 L16 16 M12 6 L8 16 M9.5 13 L14.5 13" stroke="url(#aras-compact-gradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default ArasMark;
