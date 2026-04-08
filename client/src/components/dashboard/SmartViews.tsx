import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Flame, Clock, TrendingDown, X as XIcon, Calendar, Sparkles, TrendingUp, ChevronRight, Star, Trophy, Target } from 'lucide-react';
import { CI } from '@/lib/constants';

interface SmartViewsProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onSelectLead: (lead: any) => void;
}

export function SmartViews({ activeView, setActiveView, onSelectLead }: SmartViewsProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const smartViews = [
    { id: 'money', label: '💰 MONEY MAKERS', count: 12, total: 10847, icon: DollarSign, color: CI.goldLight },
    { id: 'hot', label: '🔥 HOT LEADS', count: 34, total: 10847, icon: Flame, color: CI.orange },
    { id: 'today', label: '⏰ HEUTE WICHTIG', count: 27, total: 10847, icon: Clock, color: CI.orange },
    { id: 'cold', label: '😴 KALTE LEADS', count: 156, total: 10847, icon: TrendingDown, color: '#64748b' },
    { id: 'declined', label: '❌ ABSAGEN', count: 89, total: 10847, icon: XIcon, color: '#ef4444' },
    { id: 'appointments', label: '📅 TERMINE', count: 43, total: 10847, icon: Calendar, color: CI.goldLight }
  ];

  const moneyMakers = [
    { 
      id: 1,
      name: "TechCorp GmbH", 
      value: "€50,000", 
      chance: 95, 
      stage: "Verhandlung", 
      daysInPipe: 23,
      lastContact: "vor 2 Stunden",
      nextStep: "Vertrag senden",
      contact: "Dr. Schmidt",
      priority: "high"
    },
    { 
      id: 2,
      name: "Digital Solutions", 
      value: "€35,000", 
      chance: 88, 
      stage: "Demo", 
      daysInPipe: 15,
      lastContact: "gestern",
      nextStep: "Follow-Up Call",
      contact: "Lisa Weber",
      priority: "high"
    },
    { 
      id: 3,
      name: "Innovation AG", 
      value: "€28,000", 
      chance: 82, 
      stage: "Angebot", 
      daysInPipe: 8,
      lastContact: "vor 3 Tagen",
      nextStep: "Angebot nachfassen",
      contact: "Max Müller",
      priority: "medium"
    },
    {
      id: 4,
      name: "StartUp Valley", 
      value: "€22,000", 
      chance: 75, 
      stage: "Qualifizierung", 
      daysInPipe: 5,
      lastContact: "vor 1 Woche",
      nextStep: "Budget klären",
      contact: "Tom Klein",
      priority: "medium"
    }
  ];

  const hotLeads = [
    { id: 1, name: "BMW Group", value: "€120,000", urgency: "Heute!", reason: "CFO hat freigegeben" },
    { id: 2, name: "Siemens AG", value: "€85,000", urgency: "Diese Woche", reason: "Konkurrenzdruck" },
    { id: 3, name: "Volkswagen", value: "€67,000", urgency: "Sofort", reason: "Q4 Budget" },
  ];

  const todayTasks = [
    { id: 1, time: "10:00", task: "Call mit TechCorp", type: "call", priority: "high" },
    { id: 2, time: "11:30", task: "Demo für Digital Solutions", type: "demo", priority: "high" },
    { id: 3, time: "14:00", task: "Follow-Up Emails (23x)", type: "email", priority: "medium" },
    { id: 4, time: "16:00", task: "Team Review Meeting", type: "meeting", priority: "low" },
  ];

  const aiTips = [
    "Diese 12 Leads entsprechen 73% Ihres gesamten Umsatzpotentials!",
    "TechCorp hat eine 95% Abschluss-Wahrscheinlichkeit - Fokus darauf!",
    "Beste Call-Zeit heute: 14-16 Uhr (historisch 67% Erfolg)",
    "3 Leads werden diese Woche mit hoher Wahrscheinlichkeit abschließen"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % aiTips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [aiTips.length]);

  const getStageColor = (stage: string) => {
    const colors: { [key: string]: string } = {
      'Verhandlung': '#10b981',
      'Demo': '#3b82f6',
      'Angebot': '#f59e0b',
      'Qualifizierung': '#8b5cf6'
    };
    return colors[stage] || '#6b7280';
  };

  return (
    <div className="space-y-6">
      {/* Smart View Selector Grid */}
      <div className="grid grid-cols-3 gap-3">
        {smartViews.map((view, idx) => {
          const Icon = view.icon;
          const percentage = ((view.count / view.total) * 100).toFixed(1);
          
          return (
            <motion.button
              key={view.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView(view.id)}
              className={`p-4 rounded-xl text-left transition-all relative overflow-hidden group ${
                activeView === view.id ? 'ring-2' : ''
              }`}
              style={{
                background: activeView === view.id 
                  ? `linear-gradient(135deg, ${view.color}20, ${view.color}10)` 
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeView === view.id ? view.color : 'rgba(255,255,255,0.08)'}`
              }}
            >
              {/* Background Animation */}
              {activeView === view.id && (
                <motion.div
                  className="absolute inset-0 opacity-10"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
                  style={{
                    backgroundImage: `linear-gradient(45deg, ${view.color} 25%, transparent 25%)`,
                    backgroundSize: '20px 20px'
                  }}
                />
              )}

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-bold">{view.label}</div>
                  <Icon className="w-5 h-5 opacity-50" style={{ color: view.color }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">
                    {view.count}
                  </span>
                  <span className="text-xs text-gray-500">
                    von {view.total.toLocaleString()} ({percentage}%)
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: view.color }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                  />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Content based on active view */}
      <AnimatePresence mode="wait">
        {activeView === 'money' && (
          <motion.div
            key="money"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💰 TOP MONEY MAKERS
                <Trophy className="w-5 h-5 text-yellow-500" />
              </h3>
              <span className="text-sm text-gray-400">
                Gesamt-Potential: €135,000
              </span>
            </div>

            {/* Money Makers List */}
            {moneyMakers.map((lead, idx) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ x: 5 }}
                className="rounded-xl p-5 cursor-pointer group relative overflow-hidden"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}
                onClick={() => onSelectLead(lead)}
              >
                {/* Priority Indicator */}
                {lead.priority === 'high' && (
                  <div className="absolute top-0 right-0 w-20 h-20">
                    <div className="absolute transform rotate-45 bg-red-500 text-xs text-white py-1 right-[-35px] top-[15px] w-[100px] text-center">
                      PRIORITÄT
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    {/* Rank */}
                    <motion.div
                      className="text-3xl font-black"
                      style={{ color: idx === 0 ? CI.orange : CI.goldLight }}
                      whileHover={{ scale: 1.2, rotate: [0, -5, 5, 0] }}
                    >
                      {idx + 1}.
                    </motion.div>

                    {/* Lead Info */}
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-white text-lg">{lead.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            background: `${getStageColor(lead.stage)}20`,
                            color: getStageColor(lead.stage),
                            border: `1px solid ${getStageColor(lead.stage)}40`
                          }}
                        >
                          {lead.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>👤 {lead.contact}</span>
                        <span>📞 {lead.lastContact}</span>
                        <span>📅 {lead.daysInPipe} Tage in Pipeline</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Nächster Schritt:</span>
                        <span className="text-sm font-medium" style={{ color: CI.orange }}>
                          {lead.nextStep}
                        </span>
                        <ChevronRight className="w-3 h-3 opacity-50 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>

                  {/* Value & Chance */}
                  <div className="text-right">
                    <motion.div 
                      className="text-2xl font-bold mb-1"
                      style={{ color: CI.goldLight }}
                      animate={{ 
                        textShadow: lead.chance >= 90 
                          ? ['0 0 10px rgba(254, 145, 0, 0.5)', '0 0 20px rgba(254, 145, 0, 0.8)', '0 0 10px rgba(254, 145, 0, 0.5)']
                          : 'none'
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {lead.value}
                    </motion.div>
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className="w-3 h-3" 
                            style={{ 
                              color: i < Math.floor(lead.chance / 20) ? CI.orange : '#374151',
                              fill: i < Math.floor(lead.chance / 20) ? CI.orange : 'none'
                            }} 
                          />
                        ))}
                      </div>
                      <span className="text-sm font-bold" style={{ color: CI.orange }}>
                        {lead.chance}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover Effect - Progress Bar */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="h-full rounded-b-xl" 
                    style={{ 
                      background: `linear-gradient(90deg, ${CI.orange} ${lead.chance}%, rgba(255,255,255,0.1) ${lead.chance}%)` 
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}

            {/* AI Insight Box */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl p-4 mt-6"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(254, 145, 0, 0.03))',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: CI.orange }} />
                </motion.div>
                <span className="text-sm font-bold" style={{ color: CI.orange }}>
                  AI-INSIGHT
                </span>
                <Target className="w-4 h-4" style={{ color: CI.goldLight }} />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentTipIndex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-sm text-gray-300"
                >
                  {aiTips[currentTipIndex]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}

        {activeView === 'hot' && (
          <motion.div
            key="hot"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🔥 HEISSE LEADS - SOFORT HANDELN!
              <Flame className="w-5 h-5" style={{ color: CI.orange }} />
            </h3>
            {hotLeads.map((lead, idx) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(254, 145, 0, 0.05)',
                  border: '1px solid rgba(254, 145, 0, 0.2)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{lead.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{lead.reason}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold" style={{ color: CI.goldLight }}>
                      {lead.value}
                    </div>
                    <div className="text-xs font-bold text-red-400 animate-pulse">
                      {lead.urgency}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeView === 'today' && (
          <motion.div
            key="today"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-bold text-white">⏰ HEUTE WICHTIG</h3>
            {todayTasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="rounded-lg p-3 flex items-center justify-between"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: CI.orange }}>
                    {task.time}
                  </span>
                  <span className="text-sm text-white">{task.task}</span>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                  task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {task.priority.toUpperCase()}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
