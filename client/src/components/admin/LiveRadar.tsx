/**
 * ============================================================================
 * LIVE RADAR WIDGET — System-Auslastung & Neue Daten-Eingänge
 * ============================================================================
 * Visualisiert:
 *   - Groq API Speed (ms)
 *   - Neue E-Mails (letzte 24h)
 *   - Offene Strategien
 *   - System Health
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Mail, Brain, Zap } from "lucide-react";

interface SystemStats {
  groqSpeed: number | null;
  newMailsToday: number;
  openStrategies: number;
  systemHealth: "excellent" | "good" | "degraded" | "offline";
}

export default function LiveRadar() {
  const [stats, setStats] = useState<SystemStats>({
    groqSpeed: null,
    newMailsToday: 0,
    openStrategies: 0,
    systemHealth: "good",
  });

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Update alle 30s
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Groq Speed Test
      const groqStart = Date.now();
      const briefingRes = await fetch("/api/ceo-mind-os/morning-briefing", {
        credentials: "include",
      });
      const groqDuration = Date.now() - groqStart;

      if (briefingRes.ok) {
        const data = await briefingRes.json();
        setStats({
          groqSpeed: groqDuration,
          newMailsToday: data.stats?.newMails || 0,
          openStrategies: data.stats?.openStrategies || 0,
          systemHealth:
            groqDuration < 1000
              ? "excellent"
              : groqDuration < 2000
              ? "good"
              : "degraded",
        });
      }
    } catch (err) {
      console.error("[LIVE-RADAR] Load stats error:", err);
      setStats((prev) => ({ ...prev, systemHealth: "offline" }));
    }
  };

  const getHealthColor = () => {
    switch (stats.systemHealth) {
      case "excellent":
        return "bg-green-500";
      case "good":
        return "bg-blue-500";
      case "degraded":
        return "bg-yellow-500";
      case "offline":
        return "bg-red-500";
    }
  };

  const getHealthText = () => {
    switch (stats.systemHealth) {
      case "excellent":
        return "Optimal";
      case "good":
        return "Normal";
      case "degraded":
        return "Langsam";
      case "offline":
        return "Offline";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: "rgba(255, 255, 255, 0.4)",
        backdropFilter: "blur(25px)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* RADAR ANIMATION */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-full h-full rounded-full border-4 border-violet-600"
          style={{
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-violet-600" />
          <h3 className="text-lg font-bold text-gray-900">Live Radar</h3>
          <div className={`w-2 h-2 rounded-full ${getHealthColor()} animate-pulse`} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* GROQ SPEED */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-gray-600">Groq Speed</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.groqSpeed !== null ? `${stats.groqSpeed}ms` : "—"}
            </p>
          </div>

          {/* NEW MAILS */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Neue Mails</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.newMailsToday}</p>
          </div>

          {/* OPEN STRATEGIES */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-medium text-gray-600">Offene Tasks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.openStrategies}</p>
          </div>

          {/* SYSTEM HEALTH */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-gray-600">Status</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getHealthText()}</p>
          </div>
        </div>

        {/* PROGRESS BAR (optional visual) */}
        {stats.groqSpeed !== null && (
          <div className="mt-4">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (stats.groqSpeed / 3000) * 100)}%`,
                }}
                className={`h-full ${
                  stats.systemHealth === "excellent"
                    ? "bg-green-500"
                    : stats.systemHealth === "good"
                    ? "bg-blue-500"
                    : "bg-yellow-500"
                }`}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
