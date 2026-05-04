/**
 * ============================================================================
 * LIVE RADAR WIDGET — System-Auslastung & Neue Daten-Eingänge (IRON MAN HUD)
 * ============================================================================
 * Visualisiert:
 *   - Groq API Speed (ms)
 *   - Neue E-Mails (letzte 24h)
 *   - Offene Strategien
 *   - System Health
 *   - Rotierende Radar-Animation mit "Daten-Einschlägen"
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Mail, Brain, Zap } from "lucide-react";

interface SystemStats {
  groqSpeed: number | null;
  newMailsToday: number;
  openStrategies: number;
  systemHealth: "excellent" | "good" | "degraded" | "offline";
}

interface DataImpact {
  angle: number;
  distance: number;
  opacity: number;
  size: number;
}

export default function LiveRadar() {
  const [stats, setStats] = useState<SystemStats>({
    groqSpeed: null,
    newMailsToday: 0,
    openStrategies: 0,
    systemHealth: "good",
  });
  const [impacts, setImpacts] = useState<DataImpact[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Update alle 30s
    return () => clearInterval(interval);
  }, []);

  // Radar Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Radar Circles
      ctx.strokeStyle = "rgba(139, 92, 246, 0.2)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (radius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating Sweep Line
      angleRef.current += 0.02;
      const gradient = ctx.createLinearGradient(
        centerX,
        centerY,
        centerX + Math.cos(angleRef.current) * radius,
        centerY + Math.sin(angleRef.current) * radius
      );
      gradient.addColorStop(0, "rgba(139, 92, 246, 0)");
      gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.3)");
      gradient.addColorStop(1, "rgba(139, 92, 246, 0.6)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angleRef.current) * radius,
        centerY + Math.sin(angleRef.current) * radius
      );
      ctx.stroke();

      // Data Impacts (Blips)
      impacts.forEach((impact) => {
        const x = centerX + Math.cos(impact.angle) * impact.distance;
        const y = centerY + Math.sin(impact.angle) * impact.distance;

        ctx.fillStyle = `rgba(59, 130, 246, ${impact.opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, impact.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(59, 130, 246, ${impact.opacity * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, impact.size * 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Fade out impacts
      setImpacts((prev) =>
        prev
          .map((impact) => ({
            ...impact,
            opacity: impact.opacity - 0.01,
          }))
          .filter((impact) => impact.opacity > 0)
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [impacts]);

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
        const newStats = {
          groqSpeed: groqDuration,
          newMailsToday: data.stats?.newMails || 0,
          openStrategies: data.stats?.openStrategies || 0,
          systemHealth:
            groqDuration < 1000
              ? "excellent"
              : groqDuration < 2000
              ? "good"
              : "degraded",
        } as SystemStats;

        // Add data impacts wenn neue Daten erkannt werden
        if (newStats.newMailsToday > stats.newMailsToday) {
          addDataImpact();
        }

        setStats(newStats);
      }
    } catch (err) {
      console.error("[LIVE-RADAR] Load stats error:", err);
      setStats((prev) => ({ ...prev, systemHealth: "offline" }));
    }
  };

  const addDataImpact = () => {
    const newImpact: DataImpact = {
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * 80 + 20,
      opacity: 1,
      size: 4,
    };
    setImpacts((prev) => [...prev, newImpact]);
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
      {/* CANVAS RADAR ANIMATION */}
      <div className="absolute top-0 right-0 w-48 h-48 opacity-30 pointer-events-none">
        <canvas
          ref={canvasRef}
          width={192}
          height={192}
          className="w-full h-full"
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
