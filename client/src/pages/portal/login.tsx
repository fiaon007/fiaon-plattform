/**
 * ============================================================================
 * ARAS CLIENT PORTAL - Login Page
 * ============================================================================
 * Premium login experience for client portals
 * Isolated from main platform auth
 * ============================================================================
 */

import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function PortalLogin() {
  const { portalKey } = useParams<{ portalKey: string }>();
  const [, setLocation] = useLocation();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // STEP 21C: Check for session expired message
  const [sessionExpired, setSessionExpired] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('session_expired') === '1';
    }
    return false;
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          portalKey,
          username,
          password
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        // STEP 21B: Generic error messages (no info leaks)
        if (data.locked || response.status === 429) {
          setIsLocked(true);
          setError('');
          // Client-side countdown (30s), cleared on unmount
          setLockCountdown(30);
          const interval = setInterval(() => {
            setLockCountdown(prev => {
              if (prev <= 1) {
                clearInterval(interval);
                setIsLocked(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setError('Login fehlgeschlagen. Bitte prüfen Sie Ihre Daten.');
        }
        return;
      }
      
      // Success - redirect to portal dashboard
      setLocation(`/portal/${portalKey}`);
      
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black/40">
      {/* Background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(254,145,0,0.08) 0%, transparent 60%)'
        }}
      />
      
      {/* Login Card */}
      <div 
        className="relative w-full max-w-[420px] p-6 rounded-[20px] backdrop-blur-xl"
        style={{
          background: 'rgba(20,20,20,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'
        }}
      >
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 
            className="font-orbitron text-[22px] font-bold tracking-[0.06em] text-white mb-2"
            style={{ textShadow: '0 0 20px rgba(254,145,0,0.3)' }}
          >
            Client Portal
          </h1>
          <p className="text-sm text-white/50">
            Secure access to your dashboard
          </p>
        </div>
        
        {/* STEP 21C: Session Expired Message */}
        {sessionExpired && !error && !isLocked && (
          <div 
            className="flex items-center gap-2 p-3 mb-6 rounded-xl text-sm"
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              color: '#93c5fd'
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Session abgelaufen. Bitte erneut einloggen.</span>
          </div>
        )}
        
        {/* STEP 21B: Lock State Message */}
        {isLocked && (
          <div 
            className="flex items-center gap-2 p-3 mb-6 rounded-xl text-sm"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.2)',
              color: '#fcd34d'
            }}
          >
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>
              Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es erneut.
              {lockCountdown > 0 && ` (${lockCountdown}s)`}
            </span>
          </div>
        )}
        
        {/* Error Message */}
        {error && !isLocked && (
          <div 
            className="flex items-center gap-2 p-3 mb-6 rounded-xl text-sm"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5'
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="E-Mail"
              required
              autoComplete="username"
              className="w-full h-[44px] pl-11 pr-4 rounded-[12px] text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(254,145,0,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(254,145,0,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          
          {/* Password */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              autoComplete="current-password"
              className="w-full h-[44px] pl-11 pr-11 rounded-[12px] text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(254,145,0,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(254,145,0,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isLocked || !username || !password}
            className="w-full h-[44px] rounded-[12px] font-medium text-sm text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #FE9100 0%, #FF6B00 100%)',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(254,145,0,0.3)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(254,145,0,0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(254,145,0,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
            ) : (
              'Anmelden'
            )}
          </button>
        </form>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/30">
            Powered by{' '}
            <span className="font-orbitron text-white/50">ARAS AI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
