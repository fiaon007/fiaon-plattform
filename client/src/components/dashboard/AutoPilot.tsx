import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Shield, Zap, Clock, DollarSign, Mail, 
  Phone, Calendar, CheckCircle, X, Settings, Info,
  AlertTriangle, Brain, Play, Pause
} from 'lucide-react';
import { CI } from '@/lib/constants';

interface AutoPilotProps {
  isActive: boolean;
  onClose: () => void;
}

export function AutoPilot({ isActive, onClose }: AutoPilotProps) {
  const [settings, setSettings] = useState({
    autoEmails: true,
    autoAppointments: true,
    autoFollowUps: true,
    simpleQuestions: true,
    maxDealSize: 10000,
    notifyComplaints: true,
    notifySpecialRequests: true
  });

  const [duration, setDuration] = useState(2); // hours

  const automationStats = [
    { icon: Mail, label: 'Emails gesendet', value: '127', color: CI.orange },
    { icon: Calendar, label: 'Termine eingetragen', value: '34', color: CI.goldLight },
    { icon: Phone, label: 'Follow-Ups geplant', value: '89', color: CI.orange },
    { icon: CheckCircle, label: 'Fragen beantwortet', value: '156', color: '#10b981' }
  ];

  const upcomingActions = [
    { time: '10:15', action: 'Email an TechCorp', type: 'email' },
    { time: '10:30', action: 'Termin mit Digital AG', type: 'calendar' },
    { time: '11:00', action: 'Follow-Up StartupX', type: 'phone' },
    { time: '11:45', action: 'Vertrag an BMW senden', type: 'document' }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85))',
            border: '2px solid rgba(254, 145, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    background: isActive 
                      ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`
                      : 'rgba(255,255,255,0.1)'
                  }}
                  animate={isActive ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Activity className="w-7 h-7 text-black" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold text-white">AUTO-PILOT MODUS</h2>
                  <p className="text-sm text-gray-400">
                    {isActive 
                      ? 'ARIA übernimmt Routine-Aufgaben für Sie'
                      : 'Aktivieren Sie den automatischen Assistenten'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {isActive ? (
              <div className="space-y-6">
                {/* Active Status */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="w-3 h-3 rounded-full bg-green-500"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-sm font-bold text-white">AUTO-PILOT AKTIV</span>
                      <span className="text-xs text-gray-400">seit 10:00 Uhr</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      STOPPEN
                    </motion.button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {automationStats.map((stat, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="text-center"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                          style={{
                            background: `${stat.color}20`,
                            border: `1px solid ${stat.color}40`
                          }}
                        >
                          <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                        </div>
                        <div className="text-xl font-bold text-white">{stat.value}</div>
                        <div className="text-xs text-gray-500">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Upcoming Actions */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">NÄCHSTE AUTOMATISCHE AKTIONEN</h3>
                  <div className="space-y-2">
                    {upcomingActions.map((action, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                        className="rounded-lg p-3 flex items-center justify-between"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold" style={{ color: CI.orange }}>
                            {action.time}
                          </span>
                          <span className="text-sm text-white">{action.action}</span>
                        </div>
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-xs text-gray-400"
                        >
                          Automatisch
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Settings */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-4">AUTO-PILOT EINSTELLUNGEN</h3>
                  
                  {/* Duration Selector */}
                  <div className="mb-6">
                    <label className="text-xs text-gray-400 block mb-2">DAUER</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 4, 8].map(hours => (
                        <motion.button
                          key={hours}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setDuration(hours)}
                          className={`p-3 rounded-lg text-sm font-medium ${
                            duration === hours ? 'text-black' : 'text-white'
                          }`}
                          style={{
                            background: duration === hours 
                              ? CI.orange 
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${duration === hours ? CI.orange : 'rgba(255,255,255,0.1)'}`
                          }}
                        >
                          {hours} {hours === 1 ? 'Stunde' : 'Stunden'}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Automation Options */}
                  <div className="space-y-3">
                    <div className="text-xs text-gray-400 mb-2">AUTOMATISCHE AKTIONEN</div>
                    
                    {[
                      { key: 'autoEmails', label: 'Emails automatisch senden', icon: Mail },
                      { key: 'autoAppointments', label: 'Termine direkt bestätigen', icon: Calendar },
                      { key: 'autoFollowUps', label: 'Follow-Ups planen', icon: Phone },
                      { key: 'simpleQuestions', label: 'Einfache Fragen beantworten', icon: Brain }
                    ].map(option => (
                      <motion.label
                        key={option.key}
                        whileHover={{ x: 5 }}
                        className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                        style={{
                          background: settings[option.key as keyof typeof settings] 
                            ? 'rgba(254, 145, 0, 0.05)' 
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${settings[option.key as keyof typeof settings] 
                            ? 'rgba(254, 145, 0, 0.2)' 
                            : 'rgba(255,255,255,0.08)'}`
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <option.icon className="w-4 h-4" style={{ 
                            color: settings[option.key as keyof typeof settings] ? CI.orange : '#6b7280' 
                          }} />
                          <span className="text-sm text-white">{option.label}</span>
                        </div>
                        <motion.div
                          whileTap={{ scale: 0.9 }}
                          className="relative w-12 h-6 rounded-full cursor-pointer"
                          style={{
                            background: settings[option.key as keyof typeof settings] 
                              ? CI.orange 
                              : 'rgba(255,255,255,0.1)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettings({
                              ...settings,
                              [option.key]: !settings[option.key as keyof typeof settings]
                            });
                          }}
                        >
                          <motion.div
                            className="absolute w-5 h-5 bg-white rounded-full top-0.5"
                            animate={{
                              x: settings[option.key as keyof typeof settings] ? 24 : 2
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </motion.div>
                      </motion.label>
                    ))}
                  </div>

                  {/* Notifications */}
                  <div className="mt-6">
                    <div className="text-xs text-gray-400 mb-2">NUR STÖREN BEI</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={true}
                          className="rounded"
                          style={{ accentColor: CI.orange }}
                        />
                        <span className="text-sm text-white">Deals über €{settings.maxDealSize.toLocaleString()}</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.notifyComplaints}
                          onChange={(e) => setSettings({...settings, notifyComplaints: e.target.checked})}
                          className="rounded"
                          style={{ accentColor: CI.orange }}
                        />
                        <span className="text-sm text-white">Beschwerden</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.notifySpecialRequests}
                          onChange={(e) => setSettings({...settings, notifySpecialRequests: e.target.checked})}
                          className="rounded"
                          style={{ accentColor: CI.orange }}
                        />
                        <span className="text-sm text-white">Spezielle Anfragen</span>
                      </label>
                    </div>
                  </div>

                  {/* Info Box */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 p-3 rounded-lg"
                    style={{
                      background: 'rgba(147, 51, 234, 0.05)',
                      border: '1px solid rgba(147, 51, 234, 0.2)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-purple-400 mt-0.5" />
                      <div className="text-xs text-gray-300">
                        <p className="font-bold mb-1">So funktioniert Auto-Pilot:</p>
                        <p>ARIA übernimmt Routine-Aufgaben für die gewählte Dauer. 
                        Sie behalten die volle Kontrolle und werden nur bei wichtigen 
                        Entscheidungen informiert.</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Activate Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full mt-6 p-4 rounded-xl font-bold text-black flex items-center justify-center gap-3"
                    style={{
                      background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`
                    }}
                  >
                    <Zap className="w-5 h-5" />
                    AUTO-PILOT FÜR {duration} {duration === 1 ? 'STUNDE' : 'STUNDEN'} AKTIVIEREN
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Warning */}
          {isActive && (
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 text-xs text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Auto-Pilot läuft noch {duration - 1} Stunden. Sie können jederzeit stoppen.</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
