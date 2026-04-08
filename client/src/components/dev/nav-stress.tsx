/**
 * ============================================================================
 * NAV STRESS TEST - Dev-only component for testing navigation stability
 * ============================================================================
 * Only renders when localStorage.aras_debug === '1'
 * Tests PageTransition for "video-only" bug
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Play, Square, SkipForward, SkipBack, AlertTriangle, CheckCircle } from 'lucide-react';

const INTERNAL_ROUTES = [
  '/internal/dashboard',
  '/internal/contacts',
  '/internal/companies',
  '/internal/deals',
  '/internal/tasks',
  '/internal/calls',
];

interface TransitionLog {
  from: string;
  to: string;
  timestamp: number;
  duration: number;
}

export function NavStressTest() {
  const [location, setLocation] = useLocation();
  const [isRunning, setIsRunning] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [targetLoops, setTargetLoops] = useState(20);
  const [logs, setLogs] = useState<TransitionLog[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const lastNavTime = useRef<number>(Date.now());
  const loopRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if debug mode is enabled
  const isDebugEnabled = typeof window !== 'undefined' && localStorage.getItem('aras_debug') === '1';
  
  if (!isDebugEnabled) return null;

  const logTransition = (from: string, to: string) => {
    const now = Date.now();
    const duration = now - lastNavTime.current;
    lastNavTime.current = now;
    
    setLogs(prev => [...prev.slice(-19), { from, to, timestamp: now, duration }]);
    
    // Check for anomalies
    if (duration > 500) {
      setErrors(prev => [...prev, `Slow transition: ${from} → ${to} (${duration}ms)`]);
    }
  };

  const navigateNext = () => {
    const currentIndex = INTERNAL_ROUTES.indexOf(location);
    const nextIndex = (currentIndex + 1) % INTERNAL_ROUTES.length;
    const nextRoute = INTERNAL_ROUTES[nextIndex];
    
    logTransition(location, nextRoute);
    setLocation(nextRoute);
  };

  const navigateBack = () => {
    const currentIndex = INTERNAL_ROUTES.indexOf(location);
    const prevIndex = currentIndex <= 0 ? INTERNAL_ROUTES.length - 1 : currentIndex - 1;
    const prevRoute = INTERNAL_ROUTES[prevIndex];
    
    logTransition(location, prevRoute);
    setLocation(prevRoute);
  };

  const startLoop = () => {
    setIsRunning(true);
    setLoopCount(0);
    setErrors([]);
    loopRef.current = 0;
    
    const runLoop = () => {
      if (loopRef.current >= targetLoops) {
        setIsRunning(false);
        return;
      }
      
      navigateNext();
      loopRef.current++;
      setLoopCount(loopRef.current);
      
      timerRef.current = setTimeout(runLoop, 300); // 300ms between navigations
    };
    
    runLoop();
  };

  const stopLoop = () => {
    setIsRunning(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 z-[100] w-80 bg-black/90 border border-orange-500/50 rounded-xl p-4 text-white text-xs font-mono shadow-2xl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-orange-400 font-bold">🧪 Nav Stress Test</span>
        <span className="text-gray-500">{loopCount}/{targetLoops}</span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={navigateBack}
          disabled={isRunning}
          className="p-2 bg-white/10 rounded hover:bg-white/20 disabled:opacity-50"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={navigateNext}
          disabled={isRunning}
          className="p-2 bg-white/10 rounded hover:bg-white/20 disabled:opacity-50"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        {isRunning ? (
          <button
            onClick={stopLoop}
            className="flex-1 p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        ) : (
          <button
            onClick={startLoop}
            className="flex-1 p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Loop {targetLoops}x
          </button>
        )}
      </div>

      {/* Status */}
      <div className="text-gray-400 mb-2">
        Current: <span className="text-white">{location}</span>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded">
          <div className="flex items-center gap-1 text-red-400 mb-1">
            <AlertTriangle className="w-3 h-3" />
            {errors.length} issue(s)
          </div>
          {errors.slice(-3).map((err, i) => (
            <div key={i} className="text-red-300/70 truncate">{err}</div>
          ))}
        </div>
      )}

      {/* Success */}
      {loopCount === targetLoops && errors.length === 0 && (
        <div className="p-2 bg-green-500/10 border border-green-500/30 rounded flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          {targetLoops}x navigation: No issues!
        </div>
      )}

      {/* Recent logs */}
      <div className="max-h-24 overflow-y-auto text-[10px] text-gray-500 mt-2">
        {logs.slice(-5).map((log, i) => (
          <div key={i}>
            {log.from.split('/').pop()} → {log.to.split('/').pop()} ({log.duration}ms)
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default NavStressTest;
