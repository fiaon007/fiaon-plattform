import React, { Component, ErrorInfo, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS (V5 consistent)
// ═══════════════════════════════════════════════════════════════
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.35)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleToggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-[400px] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          <div 
            className="max-w-md w-full rounded-2xl overflow-hidden"
            style={{ 
              background: DT.panelBg, 
              backdropFilter: 'blur(20px)', 
              border: `1px solid ${DT.panelBorder}` 
            }}
          >
            {/* Top accent line */}
            <div 
              className="h-[2px] w-full"
              style={{ background: `linear-gradient(90deg, #ef4444, ${DT.orange})` }}
            />
            
            <div className="p-6 space-y-4">
              {/* Header */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 mb-1">
                  ARAS AI
                </p>
                <h2 
                  className="text-lg font-bold"
                  style={{ 
                    background: `linear-gradient(90deg, #ef4444, ${DT.orange})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {this.props.fallbackTitle || 'Ein Fehler ist aufgetreten'}
                </h2>
              </div>

              {/* Message */}
              <p className="text-sm text-neutral-400">
                Diese Komponente konnte nicht geladen werden. 
                Bitte versuche es erneut oder kontaktiere den Support.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={this.handleReload}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all hover:translate-y-[-1px]"
                  style={{ 
                    background: `linear-gradient(135deg, ${DT.orange}, #a34e00)`, 
                    color: '#000',
                    boxShadow: '0 4px 20px rgba(255,106,0,0.15)'
                  }}
                >
                  Neu laden
                </button>
                
                <button
                  onClick={this.handleToggleDetails}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-center transition-colors hover:bg-white/[0.04]"
                  style={{ color: '#888' }}
                >
                  {this.state.showDetails ? 'Details ausblenden' : 'Technische Details anzeigen'}
                </button>
              </div>

              {/* Technical Details (Accordion) */}
              {this.state.showDetails && (
                <div 
                  className="mt-4 p-3 rounded-xl overflow-auto max-h-[200px]"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <p className="text-[10px] uppercase tracking-wide text-red-400/60 mb-2">
                    Fehler
                  </p>
                  <pre className="text-[11px] text-red-300/80 font-mono whitespace-pre-wrap break-all">
                    {this.state.error?.message || 'Unknown error'}
                  </pre>
                  
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500 mt-3 mb-2">
                        Stack Trace
                      </p>
                      <pre className="text-[10px] text-neutral-600 font-mono whitespace-pre-wrap break-all">
                        {this.state.errorInfo.componentStack.slice(0, 500)}
                        {this.state.errorInfo.componentStack.length > 500 ? '...' : ''}
                      </pre>
                    </>
                  )}
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

export default ErrorBoundary;
