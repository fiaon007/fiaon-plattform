/**
 * ============================================================================
 * ARAS COMMAND CENTER - INTERNAL LAYOUT
 * ============================================================================
 * Modern Command Navigation System - 2026 Design
 * - Floating Rail (desktop) + Mobile Dock
 * - Top Command Bar with search & quick actions
 * - Premium ARAS CI - Glass, Gold, Orange glow
 * ============================================================================
 */

import { ReactNode } from "react";
import { useLocation } from "wouter";
import { CommandTopBar, CommandRail, MobileDock } from "@/components/nav";
import { InternalCommandPalette } from "./command-palette-internal";
import { DebugOverlay } from "./debug-overlay";

interface InternalLayoutProps {
  children: ReactNode;
}

export default function InternalLayout({ children }: InternalLayoutProps) {
  const [location] = useLocation();

  // Get current page title for mobile header
  const getPageTitle = () => {
    if (location.includes('/mails')) return 'Mails';
    if (location.includes('/dashboard')) return 'Dashboard';
    if (location.includes('/contacts')) return 'Contacts';
    if (location.includes('/companies')) return 'Companies';
    if (location.includes('/deals')) return 'Deals & Pipeline';
    if (location.includes('/tasks')) return 'Tasks';
    if (location.includes('/calls')) return 'Call Logs';
    if (location.includes('/contracts')) return 'Contracts';
    if (location.includes('/settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen relative" style={{ background: '#0b0b0d' }}>
      {/* Aurora Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Primary aurora glow - top right */}
        <div 
          className="absolute -top-40 -right-40 w-[900px] h-[900px] rounded-full blur-[140px] opacity-[0.12]"
          style={{ background: 'radial-gradient(circle, #FE9100 0%, transparent 65%)' }}
        />
        {/* Secondary glow - bottom left */}
        <div 
          className="absolute -bottom-20 -left-20 w-[700px] h-[700px] rounded-full blur-[120px] opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #a34e00 0%, transparent 65%)' }}
        />
        {/* Tertiary glow - center */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-[180px] opacity-[0.04]"
          style={{ background: 'radial-gradient(ellipse, #e9d7c4 0%, transparent 70%)' }}
        />
        {/* Horizon grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(233,215,196,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(233,215,196,0.15) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />
        {/* Radial vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
          }}
        />
      </div>

      {/* Command Top Bar */}
      <CommandTopBar />

      {/* Command Rail (Desktop) */}
      <CommandRail />

      {/* Mobile Dock */}
      <MobileDock />

      {/* Main Content Area */}
      <main 
        className="relative z-10 pt-16 pb-20 md:pb-8"
        style={{
          marginLeft: '0',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        {/* Desktop: Account for floating rail */}
        <div className="hidden md:block" style={{ marginLeft: '104px' }}>
          <div className="max-w-[1400px] mx-auto py-6 px-2">
            {children}
          </div>
        </div>

        {/* Mobile: Full width */}
        <div className="md:hidden">
          <div className="py-4">
            {children}
          </div>
        </div>
      </main>

      {/* Command Palette (⌘K) */}
      <InternalCommandPalette />
      
      {/* Debug Overlay - only visible when localStorage.aras_debug = "1" */}
      <DebugOverlay />

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(233,215,196,0.15);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(233,215,196,0.25);
        }
        
        /* Safe area for mobile dock */
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </div>
  );
}
