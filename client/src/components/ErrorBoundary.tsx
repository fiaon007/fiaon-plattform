// ============================================================================
// ARAS - Error Boundary
// ============================================================================
// Prevents full app crashes by catching React errors gracefully
// ============================================================================

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    
    this.setState({ errorInfo });

    // Log to analytics/monitoring service if available
    try {
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "exception", {
          description: error.message,
          fatal: false,
        });
      }
    } catch (e) {
      // Ignore analytics errors
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-[#050507] flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-6">
            {/* Error Card */}
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-red-400 font-bold text-xl">
                  Etwas ist schiefgelaufen
                </h2>
              </div>
              
              <p className="text-white/70 text-sm mb-4">
                {this.state.error?.message || "Ein unerwarteter Fehler ist aufgetreten."}
              </p>

              {/* Error details (collapsed by default) */}
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                <details className="mb-4">
                  <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                    Technische Details
                  </summary>
                  <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-white/50 overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Erneut versuchen
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Seite neu laden
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF6A00] to-[#FFB200] hover:opacity-90 text-white rounded-lg text-sm transition-opacity"
                >
                  <Home className="w-4 h-4" />
                  Zur Startseite
                </button>
              </div>
            </div>

            {/* Support Note */}
            <p className="text-center text-white/40 text-xs">
              Falls das Problem weiterhin besteht, kontaktiere bitte unseren Support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
