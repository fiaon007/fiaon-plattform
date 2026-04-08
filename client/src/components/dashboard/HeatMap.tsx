import React, { useState } from 'react';
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Calendar, Info, Zap, Target } from 'lucide-react';
import { CI } from '@/lib/constants';

export function HeatMap() {
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
  
  // Success rates for each time slot (0-100)
  const heatmapData = [
    [45, 55, 75, 85, 65, 0, 0],  // 08:00
    [65, 70, 85, 90, 75, 0, 0],  // 09:00
    [75, 85, 95, 95, 85, 15, 0], // 10:00
    [85, 90, 95, 95, 90, 20, 0], // 11:00
    [60, 65, 70, 70, 65, 15, 0], // 12:00
    [20, 25, 30, 25, 20, 0, 0],  // 13:00
    [55, 70, 75, 75, 60, 0, 0],  // 14:00
    [70, 75, 85, 85, 55, 0, 0],  // 15:00
    [65, 65, 75, 75, 30, 0, 0],  // 16:00
    [35, 40, 55, 55, 15, 0, 0],  // 17:00
    [15, 20, 25, 25, 10, 0, 0],  // 18:00
  ];

  // Additional data for tooltips
  const callVolumes = [
    [245, 355, 475, 585, 365, 0, 0],
    [465, 570, 685, 790, 575, 0, 0],
    [675, 785, 895, 995, 785, 45, 0],
    [785, 890, 995, 1095, 990, 65, 0],
    [560, 665, 770, 870, 665, 35, 0],
    [120, 125, 230, 225, 120, 0, 0],
    [355, 470, 575, 675, 460, 0, 0],
    [570, 675, 785, 885, 455, 0, 0],
    [465, 565, 675, 775, 230, 0, 0],
    [235, 340, 455, 555, 115, 0, 0],
    [115, 120, 225, 225, 80, 0, 0],
  ];

  const getColor = (value: number) => {
    if (value === 0) return 'rgba(30, 30, 30, 0.5)';
    if (value >= 80) return CI.orange;
    if (value >= 60) return CI.goldLight;
    if (value >= 40) return '#fbbf24';
    if (value >= 20) return '#60a5fa';
    return '#6b7280';
  };

  const getOpacity = (value: number) => {
    if (value === 0) return 0.2;
    return 0.3 + (value / 100) * 0.7;
  };

  const getBestTime = () => {
    let maxValue = 0;
    let bestTime = { dayIndex: 0, hourIndex: 0 };
    
    heatmapData.forEach((row, hourIdx) => {
      row.forEach((value, dayIdx) => {
        if (value > maxValue) {
          maxValue = value;
          bestTime = { dayIndex: dayIdx, hourIndex: hourIdx };
        }
      });
    });
    
    return {
      dayIndex: bestTime.dayIndex,
      hourIndex: bestTime.hourIndex,
      day: days[bestTime.dayIndex],
      hour: hours[bestTime.hourIndex],
      value: maxValue
    };
  };

  const bestTime = getBestTime();
  const totalCalls = callVolumes.flat().reduce((a, b) => a + b, 0);
  const avgSuccess = Math.round(heatmapData.flat().reduce((a, b) => a + b, 0) / heatmapData.flat().filter(v => v > 0).length);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            ERFOLGS-HEATMAP
            <BarChart3 className="w-5 h-5" style={{ color: CI.orange }} />
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Analyse von {totalCalls.toLocaleString()} Calls der letzten 30 Tage
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500">Beste Zeit</div>
            <div className="text-sm font-bold" style={{ color: CI.orange }}>
              {bestTime.day} {bestTime.hour}:00 ({bestTime.value}%)
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Ø Erfolg</div>
            <div className="text-sm font-bold text-white">{avgSuccess}%</div>
          </div>
        </div>
      </div>

      {/* Main Heatmap */}
      <div className="rounded-2xl p-6"
        style={{
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Day Labels */}
        <div className="grid grid-cols-8 gap-2 mb-3">
          <div className="text-xs text-gray-500 text-right pr-2">Zeit</div>
          {days.map(day => (
            <div key={day} className="text-xs text-gray-400 text-center font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        {hours.map((hour, hourIdx) => (
          <div key={hour} className="grid grid-cols-8 gap-2 mb-2">
            <div className="text-xs text-gray-500 text-right pr-2 flex items-center justify-end">
              {hour}:00
            </div>
            {days.map((_, dayIdx) => {
              const value = heatmapData[hourIdx][dayIdx];
              const calls = callVolumes[hourIdx][dayIdx];
              const isSelected = selectedCell?.day === dayIdx && selectedCell?.hour === hourIdx;
              const isBest = dayIdx === bestTime.dayIndex && hourIdx === bestTime.hourIndex;
              
              return (
                <motion.div
                  key={dayIdx}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCell({ day: dayIdx, hour: hourIdx })}
                  className="relative aspect-square rounded-lg cursor-pointer group"
                  style={{
                    background: getColor(value),
                    opacity: getOpacity(value),
                    border: isSelected ? `2px solid ${CI.orange}` : 'none',
                    boxShadow: isBest ? `0 0 20px ${CI.orange}60` : 'none'
                  }}
                >
                  {/* Value Display */}
                  {value > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {value}%
                      </span>
                    </div>
                  )}

                  {/* Best Time Indicator */}
                  {isBest && (
                    <motion.div
                      className="absolute -top-1 -right-1"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </motion.div>
                  )}

                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-black/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                      <div className="font-bold mb-1">{days[dayIdx]} {hour}:00</div>
                      <div>Erfolg: {value}%</div>
                      <div>Calls: {calls}</div>
                      {value > 0 && (
                        <div className="text-green-400">
                          Erfolge: {Math.round(calls * value / 100)}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: CI.orange }} />
              <span className="text-xs text-gray-400">Hot (&gt;80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: CI.goldLight }} />
              <span className="text-xs text-gray-400">Good (60-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span className="text-xs text-gray-400">OK (40-60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-xs text-gray-400">Low (20-40%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-600" />
              <span className="text-xs text-gray-400">Poor (&lt;20%)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Info className="w-3 h-3" />
            Klicken für Details
          </div>
        </div>
      </div>

      {/* Insights Cards */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-4"
          style={{
            background: 'rgba(254, 145, 0, 0.05)',
            border: '1px solid rgba(254, 145, 0, 0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4" style={{ color: CI.orange }} />
            <span className="text-xs font-bold text-white">BESTE ZEITEN</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-300">Do & Fr 10-12 Uhr</div>
            <div className="text-lg font-bold" style={{ color: CI.orange }}>95% Erfolg</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-4"
          style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-white">VERMEIDE</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-300">Mittagspause 13:00</div>
            <div className="text-lg font-bold text-red-400">25% Erfolg</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl p-4"
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-white">TREND</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-300">Vormittags</div>
            <div className="text-lg font-bold text-green-400">+23% diese Woche</div>
          </div>
        </motion.div>
      </div>

      {/* Optimization Suggestion */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.05), rgba(254, 145, 0, 0.03))',
          border: '1px solid rgba(147, 51, 234, 0.2)'
        }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Zap className="w-5 h-5 text-purple-400" />
          </motion.div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white mb-1">KI-OPTIMIERUNG</div>
            <p className="text-xs text-gray-300">
              Verschieben Sie 30% Ihrer Calls auf Do/Fr 10-12 Uhr für +15% mehr Erfolg
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{
              background: CI.orange,
              color: 'black'
            }}
          >
            JETZT OPTIMIEREN
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
