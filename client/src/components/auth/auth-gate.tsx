/**
 * AuthGate - Controls login->app transition and prevents partial rendering
 * Guarantees smooth auth flow without black screens or crashes
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchAuthUser, type AuthUser } from '@/lib/auth/fetch-auth-user';

// ARAS CI Colors
const COLORS = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  goldDark: '#a34e00',
};

type AuthState = 'booting' | 'authenticating' | 'authed' | 'unauthenticated' | 'error';

interface AuthGateProps {
  children: ReactNode;
  onUserLoaded?: (user: AuthUser) => void;
  loginPath?: string;
}

// Status messages for each phase
const STATUS_MESSAGES = [
  'Sitzung wird geladen',
  'Sicherheit wird geprüft',
  'Fast fertig',
];

export function AuthGate({ children, onUserLoaded, loginPath = '/login' }: AuthGateProps) {
  const [state, setState] = useState<AuthState>('booting');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const authenticate = useCallback(async () => {
    setState('authenticating');
    setStatusIndex(0);

    const result = await fetchAuthUser(3, (attempt) => {
      // Update status message on each retry
      setStatusIndex(Math.min(attempt, STATUS_MESSAGES.length - 1));
    });

    if (result.success && result.user) {
      setUser(result.user);
      setState('authed');
      onUserLoaded?.(result.user);
    } else if (result.code === 'UNAUTHENTICATED') {
      setState('unauthenticated');
      // Redirect to login with return path
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${loginPath}?returnTo=${returnTo}`;
    } else {
      setState('error');
      setErrorMessage(result.error || 'Verbindungsfehler');
    }
  }, [onUserLoaded, loginPath]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  // Cycle through status messages while authenticating
  useEffect(() => {
    if (state !== 'authenticating') return;
    
    const interval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % STATUS_MESSAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [state]);

  // Render children only when authenticated
  if (state === 'authed' && user) {
    return <>{children}</>;
  }

  // Show auth overlay for all other states
  return (
    <AuthOverlay
      state={state}
      statusMessage={STATUS_MESSAGES[statusIndex]}
      errorMessage={errorMessage}
      onRetry={authenticate}
      onGoToLogin={() => window.location.href = loginPath}
    />
  );
}

interface AuthOverlayProps {
  state: AuthState;
  statusMessage: string;
  errorMessage: string;
  onRetry: () => void;
  onGoToLogin: () => void;
}

function AuthOverlay({ state, statusMessage, errorMessage, onRetry, onGoToLogin }: AuthOverlayProps) {
  const isError = state === 'error';
  const isLoading = state === 'booting' || state === 'authenticating';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, rgba(12,12,12,0.96) 0%, rgba(0,0,0,0.99) 100%)',
      }}
    >
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Glass card */}
      <div 
        className="relative max-w-sm w-full mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(18,18,18,0.9)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Content */}
        <div className="p-8 text-center">
          <h1 
            className="text-lg font-bold mb-2"
            style={{ color: COLORS.gold }}
          >
            Authentifizierung
          </h1>
          
          {isLoading && (
            <p className="text-sm text-neutral-400 h-5">
              {statusMessage}
              <span className="inline-block ml-1 animate-pulse">...</span>
            </p>
          )}

          {isError && (
            <>
              <p className="text-sm text-red-400/80 mb-6">
                {errorMessage}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onRetry}
                  className="w-full py-3 px-6 rounded-xl text-sm font-semibold transition-all hover:translate-y-[-1px]"
                  style={{ 
                    background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.goldDark})`,
                    color: '#000',
                    boxShadow: '0 4px 20px rgba(255,106,0,0.2)',
                  }}
                >
                  Neu laden
                </button>
                <button
                  onClick={onGoToLogin}
                  className="w-full py-3 px-6 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.06]"
                  style={{ 
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: COLORS.gold,
                  }}
                >
                  Zur Anmeldung
                </button>
              </div>
            </>
          )}
        </div>

        {/* Animated progress line at bottom */}
        {isLoading && (
          <div className="h-[2px] w-full overflow-hidden">
            <div 
              className="h-full w-1/3 auth-progress-line"
              style={{ 
                background: `linear-gradient(90deg, transparent, ${COLORS.orange}, ${COLORS.gold}, ${COLORS.orange}, transparent)`,
              }}
            />
          </div>
        )}

        {/* Static line for error state */}
        {isError && (
          <div 
            className="h-[2px] w-full"
            style={{ background: 'rgba(239,68,68,0.4)' }}
          />
        )}
      </div>

      {/* CSS for progress animation - respects prefers-reduced-motion */}
      <style>{`
        @keyframes auth-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .auth-progress-line {
          animation: auth-progress 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-progress-line {
            animation: none;
            opacity: 0.6;
            width: 100%;
            background: linear-gradient(90deg, ${COLORS.orange}40, ${COLORS.gold}60, ${COLORS.orange}40);
          }
        }
      `}</style>
    </div>
  );
}

export default AuthGate;
