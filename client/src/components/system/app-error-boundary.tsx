/**
 * AppErrorBoundary - Global crash protection for ARAS AI
 * Guarantees no black screen ever - catches any render error and shows premium fallback
 * Includes Hard Reload for cache mismatch recovery
 */

import { Component, type ReactNode } from 'react';
import { BUILD_ID, forceHardReload } from '@/lib/system/build-id';
import { formatTraceForDisplay } from '@/lib/system/module-trace';
import { getRuntimeDiag } from '@/lib/system/runtime-diag';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

// ARAS CI Colors
const COLORS = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  goldDark: '#a34e00',
};

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log only in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[AppErrorBoundary] Caught error:', error);
      console.error('[AppErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReload = () => {
    forceHardReload();
  };

  handleGoToLogin = () => {
    window.location.href = '/login';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  copyErrorDetails = async () => {
    if (!this.state.error) return;
    try {
      const diag = getRuntimeDiag();
      const trace = formatTraceForDisplay();
      const details = `ARAS Error Report
═══════════════════════════════════════
BUILD: ${BUILD_ID}
TIME: ${new Date().toISOString()}
URL: ${diag.href}
USER AGENT: ${diag.userAgent}
TIMEZONE: ${diag.timezone}
ONLINE: ${diag.onLine}

ERROR
─────
${this.state.error.message}

STACK TRACE
───────────
${this.state.error.stack || 'N/A'}

MODULE TRACE (last 40)
──────────────────────
${trace}
═══════════════════════════════════════`;
      await navigator.clipboard.writeText(details);
    } catch {
      // Ignore clipboard errors
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(12,12,12,0.95) 0%, rgba(0,0,0,0.99) 100%)',
          }}
        >
          {/* Subtle noise texture */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Glass card */}
          <div 
            className="relative max-w-md w-full mx-4 p-8 rounded-2xl text-center"
            style={{
              background: 'rgba(20,20,20,0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Top accent line */}
            <div 
              className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
              style={{ 
                background: `linear-gradient(90deg, ${COLORS.orange}, ${COLORS.gold}, ${COLORS.orange})`,
              }}
            />

            {/* Error indicator - simple X shape */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.25)' }}
            >
              <div className="relative w-6 h-6">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/60 -translate-y-1/2 rotate-45" />
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/60 -translate-y-1/2 -rotate-45" />
              </div>
            </div>

            <h1 
              className="text-xl font-bold mb-2"
              style={{ color: COLORS.gold }}
            >
              Ein Fehler ist aufgetreten
            </h1>
            
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Die Anwendung konnte nicht geladen werden. 
              Bitte versuche es erneut oder melde dich neu an.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
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
                onClick={this.handleHardReload}
                className="w-full py-3 px-6 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.06]"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: COLORS.gold,
                }}
              >
                Hard Reload (Cache leeren)
              </button>
              
              <button
                onClick={this.handleGoToLogin}
                className="w-full py-2 px-4 rounded-lg text-xs font-medium transition-all hover:bg-white/[0.04]"
                style={{ 
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                Zur Anmeldung
              </button>
            </div>

            {/* Technical details toggle */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={this.toggleDetails}
                className="text-[10px] text-neutral-600 hover:text-neutral-500 transition-colors"
              >
                {this.state.showDetails ? 'Details ausblenden' : 'Technische Details'}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 text-left">
                  <div 
                    className="p-3 rounded-lg text-[10px] font-mono overflow-auto max-h-32 mb-2"
                    style={{ background: 'rgba(0,0,0,0.4)', color: '#666' }}
                  >
                    <div className="mb-1">Build: {BUILD_ID}</div>
                    <div className="mb-1">Time: {new Date().toISOString()}</div>
                    <div>Error: {this.state.error?.message || 'Unknown'}</div>
                  </div>
                  <button
                    onClick={this.copyErrorDetails}
                    className="text-[9px] text-neutral-600 hover:text-neutral-500 transition-colors"
                  >
                    Details kopieren
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
