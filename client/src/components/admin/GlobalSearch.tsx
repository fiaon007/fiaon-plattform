"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, X, Users, TrendingUp, Building2, Megaphone,
  Phone, Mail, Sparkles, ArrowRight, Clock, Command,
  Loader2, AlertCircle, Zap, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Icon Mapping
// ============================================================================
const ICON_MAP: Record<string, any> = {
  user: Users,
  lead: TrendingUp,
  contact: Building2,
  campaign: Megaphone,
  call: Phone,
  email: Mail,
};

// ============================================================================
// Types
// ============================================================================
interface SearchResult {
  id: string | number;
  type: string;
  title: string;
  subtitle: string;
  metadata: Record<string, any>;
  url: string;
  icon: string;
  color: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Global Search Modal Component
// ============================================================================
export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // AI Search mutation
  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const useAI = searchQuery.length > 10;
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}&limit=20&ai=${useAI}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
  });

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      searchMutation.reset();
      return;
    }

    const timer = setTimeout(() => {
      searchMutation.mutate(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Flatten results for navigation
  const flatResults = useMemo(() => {
    if (!searchMutation.data?.results) return [];
    const results: SearchResult[] = [];
    const { users, leads, contacts, campaigns, calls, emails } = searchMutation.data.results;
    results.push(...(users || []), ...(leads || []), ...(contacts || []), 
                ...(campaigns || []), ...(calls || []), ...(emails || []));
    return results;
  }, [searchMutation.data]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelect(flatResults[selectedIndex]);
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const element = resultsRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Handle result selection
  const handleSelect = useCallback((result: SearchResult) => {
    setLocation(result.url);
    onClose();
  }, [setLocation, onClose]);

  // Quick actions
  const quickActions = [
    { label: "View all users", url: "/admin-dashboard/users", icon: Users, shortcut: "U" },
    { label: "View all leads", url: "/admin-dashboard/leads", icon: TrendingUp, shortcut: "L" },
    { label: "View activity", url: "/admin-dashboard/activity", icon: Zap, shortcut: "A" },
    { label: "Export data", url: "/admin-dashboard/exports", icon: ExternalLink, shortcut: "E" },
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/70 backdrop-blur-md px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 border-b border-white/10">
          <Search className="w-5 h-5 text-white/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, leads, contacts, emails..."
            className="flex-1 py-4 bg-transparent text-white text-lg placeholder:text-white/30 focus:outline-none"
          />
          {searchMutation.isPending && (
            <Loader2 className="w-5 h-5 text-[#FF6A00] animate-spin" />
          )}
          <kbd className="px-2 py-1 text-[10px] text-white/30 bg-white/5 rounded border border-white/10">
            ESC
          </kbd>
        </div>

        {/* AI Insight */}
        {searchMutation.data?.results?.ai?.insight && (
          <div className="px-5 py-3 bg-gradient-to-r from-[#FF6A00]/10 to-[#FFB200]/10 border-b border-white/10">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#FF6A00] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-white/70">
                {searchMutation.data.results.ai.insight}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            // Quick Actions
            <div className="p-4">
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3 px-1">
                Quick Actions
              </div>
              <div className="space-y-1">
                {quickActions.map((action, i) => (
                  <button
                    key={action.url}
                    onClick={() => { setLocation(action.url); onClose(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                      "hover:bg-white/5 group"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#FF6A00]/20 transition-colors">
                      <action.icon className="w-4 h-4 text-white/50 group-hover:text-[#FF6A00]" />
                    </div>
                    <span className="text-sm text-white/70 group-hover:text-white flex-1">
                      {action.label}
                    </span>
                    <kbd className="px-2 py-0.5 text-[10px] text-white/30 bg-white/5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {action.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
              
              {/* Tips */}
              <div className="mt-6 px-1">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
                  Search Tips
                </div>
                <div className="text-xs text-white/40 space-y-1">
                  <p>• Type at least 2 characters to search</p>
                  <p>• Use ↑↓ arrows to navigate, Enter to select</p>
                  <p>• AI will provide smart insights on your results</p>
                </div>
              </div>
            </div>
          ) : searchMutation.isPending ? (
            // Loading state
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-[#FF6A00] animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/50">Searching across all data...</p>
            </div>
          ) : flatResults.length === 0 ? (
            // No results
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/50">No results found for "{query}"</p>
              <p className="text-xs text-white/30 mt-1">Try a different search term</p>
            </div>
          ) : (
            // Results grouped by type
            <div className="p-2">
              {Object.entries(searchMutation.data?.results || {}).map(([type, items]) => {
                if (type === "ai" || !Array.isArray(items) || items.length === 0) return null;
                
                return (
                  <div key={type} className="mb-4">
                    <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2 px-3">
                      {type} ({items.length})
                    </div>
                    <div className="space-y-1">
                      {(items as SearchResult[]).map((result, i) => {
                        const globalIndex = flatResults.findIndex(r => r.id === result.id && r.type === result.type);
                        const Icon = ICON_MAP[result.type] || Search;
                        
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            data-index={globalIndex}
                            onClick={() => handleSelect(result)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                              globalIndex === selectedIndex
                                ? "bg-[#FF6A00]/20 border border-[#FF6A00]/30"
                                : "hover:bg-white/5 border border-transparent"
                            )}
                          >
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${result.color}20` }}
                            >
                              <Icon className="w-5 h-5" style={{ color: result.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">
                                {result.title}
                              </p>
                              <p className="text-xs text-white/40 truncate">
                                {result.subtitle}
                              </p>
                            </div>
                            <ArrowRight className={cn(
                              "w-4 h-4 transition-opacity",
                              globalIndex === selectedIndex ? "text-[#FF6A00] opacity-100" : "text-white/20 opacity-0"
                            )} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded">↵</kbd>
              Select
            </span>
          </div>
          {searchMutation.data?.totalResults !== undefined && (
            <span className="text-xs text-white/40">
              {searchMutation.data.totalResults} results found
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default GlobalSearch;
