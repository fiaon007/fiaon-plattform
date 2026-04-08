"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { 
  Command, Search, Users, TrendingUp, Activity, Download,
  MessageCircle, Settings, Bell, LayoutDashboard, Keyboard,
  X, ArrowUp, ArrowDown, CornerDownLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Shortcut Definitions
// ============================================================================
interface Shortcut {
  key: string;
  modifiers: ("cmd" | "ctrl" | "shift" | "alt")[];
  description: string;
  category: string;
  action: () => void;
  icon?: any;
}

// ============================================================================
// Keyboard Shortcuts Provider
// ============================================================================
interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  onOpenNotifications: () => void;
}

export function KeyboardShortcutsProvider({
  children,
  onOpenSearch,
  onToggleSidebar,
  onOpenNotifications,
}: KeyboardShortcutsProviderProps) {
  const [, setLocation] = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  // Define shortcuts
  const shortcuts: Shortcut[] = [
    // Global
    { key: "k", modifiers: ["cmd"], description: "Open search", category: "Global", action: onOpenSearch, icon: Search },
    { key: "b", modifiers: ["cmd"], description: "Toggle sidebar", category: "Global", action: onToggleSidebar, icon: Command },
    { key: "n", modifiers: ["cmd"], description: "Open notifications", category: "Global", action: onOpenNotifications, icon: Bell },
    { key: "/", modifiers: [], description: "Show keyboard shortcuts", category: "Global", action: () => setHelpOpen(true), icon: Keyboard },
    { key: "Escape", modifiers: [], description: "Close modal / Go back", category: "Global", action: () => setHelpOpen(false) },
    
    // Navigation
    { key: "g", modifiers: ["cmd"], description: "Go to Dashboard", category: "Navigation", action: () => setLocation("/admin-dashboard"), icon: LayoutDashboard },
    { key: "u", modifiers: ["cmd", "shift"], description: "Go to Users", category: "Navigation", action: () => setLocation("/admin-dashboard/users"), icon: Users },
    { key: "l", modifiers: ["cmd", "shift"], description: "Go to Leads", category: "Navigation", action: () => setLocation("/admin-dashboard/leads"), icon: TrendingUp },
    { key: "a", modifiers: ["cmd", "shift"], description: "Go to Activity", category: "Navigation", action: () => setLocation("/admin-dashboard/activity"), icon: Activity },
    { key: "e", modifiers: ["cmd", "shift"], description: "Go to Exports", category: "Navigation", action: () => setLocation("/admin-dashboard/exports"), icon: Download },
    { key: "c", modifiers: ["cmd", "shift"], description: "Go to Team Chat", category: "Navigation", action: () => setLocation("/admin-dashboard/team-chat"), icon: MessageCircle },
    { key: "s", modifiers: ["cmd", "shift"], description: "Go to Settings", category: "Navigation", action: () => setLocation("/admin-dashboard/settings"), icon: Settings },
  ];

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        // Allow Escape in inputs
        if (e.key !== "Escape") return;
      }

      for (const shortcut of shortcuts) {
        const cmdMatch = shortcut.modifiers.includes("cmd") === (e.metaKey || e.ctrlKey);
        const shiftMatch = shortcut.modifiers.includes("shift") === e.shiftKey;
        const altMatch = shortcut.modifiers.includes("alt") === e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (cmdMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  return (
    <>
      {children}
      <AnimatePresence>
        {helpOpen && (
          <KeyboardShortcutsHelp 
            shortcuts={shortcuts} 
            onClose={() => setHelpOpen(false)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Keyboard Shortcuts Help Modal
// ============================================================================
interface KeyboardShortcutsHelpProps {
  shortcuts: Shortcut[];
  onClose: () => void;
}

function KeyboardShortcutsHelp({ shortcuts, onClose }: KeyboardShortcutsHelpProps) {
  // Group by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#FFB200] flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Keyboard Shortcuts</h2>
              <p className="text-sm text-white/40">Power-user features at your fingertips</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut) => (
                  <div
                    key={`${shortcut.key}-${shortcut.modifiers.join("-")}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {shortcut.icon && (
                        <shortcut.icon className="w-4 h-4 text-white/40" />
                      )}
                      <span className="text-sm text-white/70">{shortcut.description}</span>
                    </div>
                    <ShortcutKeys 
                      keys={[
                        ...shortcut.modifiers.map(m => m === "cmd" ? "⌘" : m === "shift" ? "⇧" : m === "alt" ? "⌥" : m),
                        shortcut.key.toUpperCase()
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-center gap-6 text-xs text-white/30">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">⌘</kbd>
              = Command/Ctrl
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">⇧</kbd>
              = Shift
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">/</kbd>
              = Show this help
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Shortcut Keys Display Component
// ============================================================================
function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={cn(
            "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5",
            "text-[11px] font-medium",
            "bg-white/5 border border-white/10 rounded",
            "text-white/50"
          )}
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

// ============================================================================
// Inline Shortcut Hint Component
// ============================================================================
export function ShortcutHint({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[18px] h-5 px-1 text-[10px] font-medium bg-white/5 border border-white/10 rounded text-white/40"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export default KeyboardShortcutsProvider;
