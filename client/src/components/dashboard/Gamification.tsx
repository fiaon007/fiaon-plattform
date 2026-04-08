import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Target, Zap, Award, Star, TrendingUp, 
  Users, Crown, Medal, Gift, Flame, ChevronUp
} from 'lucide-react';
import { CI } from '@/lib/constants';

export function Gamification() {
  const [currentLevel, setCurrentLevel] = useState(47);
  const [levelProgress, setLevelProgress] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const achievements = [
    { 
      id: 1, 
      icon: Zap, 
      title: 'SPEED DEMON', 
      description: '100 Calls in 1 Stunde', 
      unlocked: true, 
      color: CI.orange,
      points: 500
    },
    { 
      id: 2, 
      icon: Trophy, 
      title: 'WHALE HUNTER', 
      description: '€50k+ Deal geclosed', 
      unlocked: true, 
      color: CI.goldLight,
      points: 1000
    },
    { 
      id: 3, 
      icon: Flame, 
      title: 'ON FIRE', 
      description: '10 Termine an einem Tag', 
      unlocked: true, 
      color: '#ef4444',
      points: 750
    },
    { 
      id: 4, 
      icon: Crown, 
      title: 'SALES KING', 
      description: '€1M Pipeline erreicht', 
      unlocked: false, 
      color: '#fbbf24',
      points: 2000
    }
  ];

  const leaderboard = [
    { rank: 1, name: 'DU', team: 'Alpha Team', value: '€147k', trend: '+23%', isUser: true },
    { rank: 2, name: 'Team Berlin', team: 'Beta Squad', value: '€89k', trend: '+15%' },
    { rank: 3, name: 'Team München', team: 'Gamma Force', value: '€67k', trend: '+8%' },
    { rank: 4, name: 'Team Hamburg', team: 'Delta Unit', value: '€45k', trend: '+5%' }
  ];

  const dailyGoals = [
    { label: 'Anrufe', current: 847, target: 1000, icon: Zap },
    { label: 'Termine', current: 34, target: 40, icon: Target },
    { label: 'Abschlüsse', current: 7, target: 10, icon: Trophy }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setLevelProgress(82);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (levelProgress >= 100) {
      setShowLevelUp(true);
      setTimeout(() => {
        setCurrentLevel(48);
        setLevelProgress(0);
        setShowLevelUp(false);
      }, 3000);
    }
  }, [levelProgress]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return CI.orange;
    if (rank === 2) return CI.goldLight;
    if (rank === 3) return '#cd7f32';
    return '#6b7280';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return Crown;
    if (rank === 2) return Medal;
    if (rank === 3) return Award;
    return Star;
  };

  return (
    <div className="space-y-6">
      {/* Level Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.05), rgba(233, 215, 196, 0.03))',
          border: '2px solid rgba(254, 145, 0, 0.2)'
        }}
      >
        <div className="p-5">
          {/* Level Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`,
                  boxShadow: `0 20px 40px ${CI.orange}40`
                }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Trophy className="w-6 h-6 text-black" />
              </motion.div>
              <div>
                <div className="text-xs text-gray-400">DEIN SALES LEVEL</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">
                    Level {currentLevel}
                  </span>
                  <ChevronUp className="w-4 h-4 text-green-400" />
                  <span className="text-xl font-bold text-gray-400">
                    Level {currentLevel + 1}
                  </span>
                </div>
              </div>
            </div>
            
            {/* XP Counter */}
            <div className="text-right">
              <div className="text-xs text-gray-400">XP HEUTE</div>
              <motion.div 
                className="text-2xl font-black"
                style={{ color: CI.goldLight }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                +3,450
              </motion.div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="h-4 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldLight})`
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 0%'],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  style={{
                    backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    backgroundSize: '200% 100%'
                  }}
                />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">
                {Math.round(levelProgress * 50)} / 5,000 XP
              </span>
              <span className="text-xs font-bold" style={{ color: CI.orange }}>
                {levelProgress}%
              </span>
            </div>
          </div>

          {/* Daily Goals */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {dailyGoals.map((goal, idx) => {
              const percentage = (goal.current / goal.target) * 100;
              const Icon = goal.icon;
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="rounded-lg p-3"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4" style={{ color: CI.goldLight }} />
                    <span className="text-xs font-bold text-white">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">{goal.label}</div>
                  <div className="text-sm font-bold text-white">
                    {goal.current}/{goal.target}
                  </div>
                  <div className="h-1 bg-black/30 rounded-full overflow-hidden mt-2">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: percentage >= 100 ? '#10b981' : CI.orange }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl p-4"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            ACHIEVEMENTS
            <Star className="w-4 h-4" style={{ color: CI.goldLight }} />
          </h3>
          <span className="text-xs text-gray-400">3/12 freigeschaltet</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {achievements.slice(0, 4).map((achievement, idx) => {
            const Icon = achievement.icon;
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className={`rounded-lg p-2 cursor-pointer relative ${
                  achievement.unlocked ? '' : 'opacity-50 grayscale'
                }`}
                style={{
                  background: achievement.unlocked 
                    ? `${achievement.color}10` 
                    : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${achievement.unlocked ? achievement.color : 'rgba(255,255,255,0.1)'}40`
                }}
              >
                {achievement.unlocked && (
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </motion.div>
                )}

                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" style={{ 
                    color: achievement.unlocked ? achievement.color : '#6b7280' 
                  }} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">
                      {achievement.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      +{achievement.points} XP
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Team Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              TEAM LEADERBOARD
              <Users className="w-4 h-4" style={{ color: CI.goldLight }} />
            </h3>
            <span className="text-xs text-gray-400">Diese Woche</span>
          </div>

          <div className="space-y-2">
            {leaderboard.map((entry, idx) => {
              const RankIcon = getRankIcon(entry.rank);
              
              return (
                <motion.div
                  key={entry.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className={`rounded-lg p-3 flex items-center justify-between ${
                    entry.isUser ? 'ring-2' : ''
                  }`}
                  style={{
                    background: entry.isUser 
                      ? 'rgba(254, 145, 0, 0.1)' 
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${entry.isUser ? CI.orange : 'rgba(255,255,255,0.08)'}`
                  }}
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: `${getRankColor(entry.rank)}20`,
                        border: `1px solid ${getRankColor(entry.rank)}40`
                      }}
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                    >
                      <RankIcon className="w-4 h-4" style={{ color: getRankColor(entry.rank) }} />
                    </motion.div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {entry.name}
                        </span>
                        {entry.isUser && (
                          <motion.span
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400"
                          >
                            YOU
                          </motion.span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{entry.team}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{entry.value}</div>
                    <div className="text-xs text-green-400">
                      <TrendingUp className="w-3 h-3 inline" />
                      {entry.trend}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Level Up Animation */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <motion.div
              className="text-6xl font-black text-center"
              style={{ color: CI.orange }}
              animate={{
                scale: [1, 1.2, 1],
                textShadow: [
                  `0 0 20px ${CI.orange}`,
                  `0 0 40px ${CI.orange}`,
                  `0 0 20px ${CI.orange}`
                ]
              }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              LEVEL UP!
              <div className="text-2xl mt-2">Level 48 erreicht!</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
