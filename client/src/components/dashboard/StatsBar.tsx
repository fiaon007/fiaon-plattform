import React from 'react';
import { motion } from "framer-motion";
import { Phone, Calendar, Mail, DollarSign, ArrowUp, ArrowDown, TrendingUp, Users, Target, Zap } from 'lucide-react';
import { CI } from '@/lib/constants';

interface StatsBarProps {
  animatedStats: {
    calls: number;
    appointments: number;
    followUps: number;
    pipeline: number;
  };
}

export function StatsBar({ animatedStats }: StatsBarProps) {
  const stats = [
    { 
      label: 'Anrufe Heute', 
      value: animatedStats.calls, 
      icon: Phone, 
      color: CI.orange, 
      trend: '+12%',
      subtext: 'vs. gestern',
      target: 12000,
      bgGradient: `linear-gradient(135deg, ${CI.orange}20, ${CI.orange}10)`
    },
    { 
      label: 'Termine', 
      value: animatedStats.appointments, 
      icon: Calendar, 
      color: CI.goldLight, 
      trend: '+8%',
      subtext: 'diese Woche',
      target: 400,
      bgGradient: `linear-gradient(135deg, ${CI.goldLight}20, ${CI.goldLight}10)`
    },
    { 
      label: 'Follow-Ups', 
      value: animatedStats.followUps, 
      icon: Mail, 
      color: CI.orange, 
      trend: '+23%',
      subtext: 'Response Rate',
      target: 1500,
      bgGradient: `linear-gradient(135deg, ${CI.orange}20, ${CI.orange}10)`
    },
    { 
      label: 'Pipeline', 
      value: `€${(animatedStats.pipeline / 1000).toFixed(0)}k`, 
      icon: DollarSign, 
      color: CI.goldLight, 
      trend: '+15%',
      subtext: 'Monatsziel: €500k',
      target: 500000,
      isMonetary: true,
      bgGradient: `linear-gradient(135deg, ${CI.goldLight}20, ${CI.goldLight}10)`
    }
  ];

  const additionalStats = [
    { icon: Users, label: 'Neue Leads', value: '847', change: '+127' },
    { icon: Target, label: 'Conversion', value: '4.2%', change: '+0.8%' },
    { icon: Zap, label: 'Ø Call Zeit', value: '3:42', change: '-18s' }
  ];

  return (
    <>
      {/* Main Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-4 gap-4"
      >
        {stats.map((stat, idx) => {
          const progress = stat.isMonetary 
            ? (animatedStats.pipeline / stat.target) * 100
            : (typeof stat.value === 'number' ? (stat.value / stat.target) * 100 : 0);

          return (
            <motion.div
              key={idx}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: 0.5 + idx * 0.1, 
                type: "spring", 
                stiffness: 200,
                damping: 20
              }}
              whileHover={{ 
                scale: 1.05,
                y: -4,
                boxShadow: `0 25px 50px ${stat.color}35`
              }}
              className="glass-card rounded-3xl p-6 cursor-pointer relative overflow-hidden group glass-transition"
              style={{
                background: stat.bgGradient,
                border: `1px solid ${stat.color}30`,
                boxShadow: `0 10px 30px ${stat.color}15`
              }}
            >
              {/* Animated Background Pattern */}
              <motion.div
                className="absolute inset-0 opacity-10"
                animate={{
                  backgroundPosition: ['0% 0%', '100% 100%'],
                }}
                transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, ${stat.color}20 0px, transparent 10px, transparent 20px)`,
                  backgroundSize: '40px 40px'
                }}
              />

              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `${stat.color}20`,
                      border: `1px solid ${stat.color}40`
                    }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </motion.div>
                  
                  <motion.div 
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{
                      background: stat.trend.startsWith('+') 
                        ? 'rgba(16, 185, 129, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                      color: stat.trend.startsWith('+') ? '#10b981' : '#ef4444'
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + idx * 0.1 }}
                  >
                    {stat.trend.startsWith('+') ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    <span className="font-bold">{stat.trend}</span>
                  </motion.div>
                </div>

                {/* Value */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + idx * 0.1 }}
                  className="mb-2"
                >
                  <div 
                    className="text-3xl font-black tracking-tight"
                    style={{ 
                      color: stat.color, 
                      fontFamily: 'Orbitron, sans-serif',
                      textShadow: `0 0 20px ${stat.color}50`
                    }}
                  >
                    {typeof stat.value === 'number' ? (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                      >
                        {stat.value.toLocaleString()}
                      </motion.span>
                    ) : stat.value}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
                </motion.div>

                {/* Progress Bar */}
                <div className="relative h-1.5 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${stat.color}, ${stat.color}CC)`,
                      boxShadow: `0 0 10px ${stat.color}60`
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ delay: 1 + idx * 0.1, duration: 1, ease: "easeOut" }}
                  />
                </div>

                {/* Subtext */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{stat.subtext}</span>
                  <span className="text-xs font-bold" style={{ color: stat.color }}>
                    {progress.toFixed(0)}%
                  </span>
                </div>

                {/* Hover Effect - Show More Info */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  className="absolute inset-x-0 bottom-0 bg-black/90 p-3 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="text-xs text-gray-300">
                    Ziel: {stat.target.toLocaleString()}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Additional Mini Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="grid grid-cols-3 gap-3 mt-4"
      >
        {additionalStats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.3 + idx * 0.1 }}
            className="rounded-lg p-3 flex items-center gap-3"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ 
                background: 'rgba(254, 145, 0, 0.1)',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <stat.icon className="w-4 h-4" style={{ color: CI.orange }} />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">{stat.label}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{stat.value}</span>
                <span className="text-xs" style={{ color: CI.goldLight }}>
                  {stat.change}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
