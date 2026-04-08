/**
 * ARAS Module Boundary - Error Boundary for Dashboard Sections
 * Prevents full dashboard crash when a single module fails
 * ARAS 2026 design - premium error UI with retry + diagnostics
 */

import React, { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.45)',
  panelBorder: 'rgba(255,255,255,0.08)',
  matrixGreen: 'rgba(0,255,136,0.85)',
  errorRed: '#ef4444',
};

// Generate diagnostic ID
function generateDiagId(userId?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  const userShort = userId ? userId.slice(0, 6) : 'anon';
  return `${timestamp}-${random}-${userShort}`;
}

interface ModuleBoundaryProps {
  children: ReactNode;
  moduleName: string;
  userId?: string;
  fallbackHeight?: string;
}

interface ModuleBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  diagId: string | null;
}

export class ModuleBoundary extends Component<ModuleBoundaryProps, ModuleBoundaryState> {
  constructor(props: ModuleBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      diagId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ModuleBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const diagId = generateDiagId(this.props.userId);
    this.setState({ errorInfo, diagId });
    
    // Log to console for debugging
    console.error(`[ModuleBoundary] ${this.props.moduleName} crashed:`, error);
    console.error('[ModuleBoundary] Component stack:', errorInfo.componentStack);
    console.error('[ModuleBoundary] Diagnostic ID:', diagId);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      diagId: null,
    });
  };

  handleCopyDetails = async (): Promise<void> => {
    const { moduleName } = this.props;
    const { error, errorInfo, diagId } = this.state;
    
    const details = [
      `ARAS Diagnose-Report`,
      `═══════════════════════════════════`,
      `Diagnose-ID: ${diagId}`,
      `Modul: ${moduleName}`,
      `Zeitpunkt: ${new Date().toISOString()}`,
      ``,
      `Fehler: ${error?.message || 'Unbekannt'}`,
      ``,
      `Stack:`,
      error?.stack || 'Nicht verfügbar',
      ``,
      `Component Stack:`,
      errorInfo?.componentStack || 'Nicht verfügbar',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(details);
      // Could show a toast here, but keeping it simple
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  render(): ReactNode {
    const { children, moduleName, fallbackHeight = '200px' } = this.props;
    const { hasError, error, diagId } = this.state;

    if (hasError) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: DT.panelBg,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${DT.panelBorder}`,
            minHeight: fallbackHeight,
          }}
        >
          {/* Subtle scanline overlay (10% intensity) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
            }}
          />

          {/* Orange edge glow */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 1px ${DT.orange}20, 0 0 20px ${DT.orange}10`,
            }}
          />

          <div className="p-4 relative z-10">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: DT.errorRed }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: DT.errorRed }}>
                Modul-Fehler
              </span>
              <span className="text-[10px] text-neutral-500">|</span>
              <span className="text-[10px] text-neutral-500">{moduleName}</span>
            </div>

            {/* Error message */}
            <p className="text-xs text-neutral-400 mb-4">
              {error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={this.handleRetry}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:translate-y-[-1px]"
                style={{
                  background: `linear-gradient(135deg, ${DT.orange}, ${DT.orange}cc)`,
                  color: '#000',
                  boxShadow: `0 4px 12px ${DT.orange}30`,
                }}
              >
                Neu versuchen
              </button>
              <button
                onClick={this.handleCopyDetails}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-white/[0.06]"
                style={{ color: DT.gold, border: `1px solid ${DT.panelBorder}` }}
              >
                Details kopieren
              </button>
            </div>

            {/* Diagnostic ID */}
            {diagId && (
              <p
                className="text-[9px] font-mono"
                style={{ color: DT.matrixGreen }}
              >
                Diagnose-ID: {diagId}
              </p>
            )}
          </div>
        </motion.div>
      );
    }

    return children;
  }
}

export default ModuleBoundary;
