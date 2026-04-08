/**
 * ============================================================================
 * ARAS COMMAND CENTER - Hint Button + Sheet
 * ============================================================================
 * Contextual help for each internal page with real actions
 */

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Sparkles, Plus, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  label: string;
  icon?: typeof Plus;
  onClick: () => void;
}

interface HintContent {
  title: string;
  description: string;
  tips: string[];
  quickActions?: QuickAction[];
  troubleshooting?: string;
}

interface HintButtonProps {
  content: HintContent;
}

export function HintButton({ content }: HintButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-orange-400 hover:bg-white/10 transition-all"
        title="Help & Tips"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Sheet Panel */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-white/10 z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20">
                      <Sparkles className="w-5 h-5 text-orange-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">{content.title}</h2>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Description */}
                <p className="text-gray-400 leading-relaxed">
                  {content.description}
                </p>

                {/* Quick Actions */}
                {content.quickActions && content.quickActions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      {content.quickActions.map((action, i) => {
                        const Icon = action.icon || ChevronRight;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              action.onClick();
                              setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-orange-500/10 hover:border-orange-500/30 transition-all group"
                          >
                            <span className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-gray-400 group-hover:text-orange-400" />
                              {action.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Tips & Features</h3>
                  <ul className="space-y-2">
                    {content.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-orange-400 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Troubleshooting */}
                {content.troubleshooting && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Troubleshooting
                    </h3>
                    <p className="text-sm text-yellow-400/80">
                      {content.troubleshooting}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 text-center">
                    Powered by ARAS AI • All data stays confidential
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Pre-defined hint content for each page
export const HINT_CONTENT = {
  dashboard: {
    title: 'Dashboard Help',
    description: 'Your command center overview showing KPIs, pipeline status, and AI insights.',
    tips: [
      'KPI cards update every 30 seconds automatically',
      'Click "ARAS AI Insights" for weekly analysis',
      'Pipeline shows deal distribution across stages',
    ],
    troubleshooting: 'If data is missing, check your network connection and try refreshing the page.',
  },
  contacts: {
    title: 'Contacts Help',
    description: 'Manage all your business contacts. Create, edit, and get AI summaries.',
    tips: [
      'Click any contact to view details and AI summary',
      'Use search to filter by name, email, or phone',
      'Status badges show contact engagement level',
      'ARAS AI can analyze contact history and suggest actions',
    ],
    troubleshooting: 'If contacts are not loading, check if you have the correct permissions.',
  },
  companies: {
    title: 'Companies Help',
    description: 'Track all companies in your pipeline with industry and website info.',
    tips: [
      'Hover over a company card to see edit/delete options',
      'Tags help categorize companies by type',
      'Link contacts to companies for better organization',
    ],
    troubleshooting: 'Empty list? Create your first company using the button above.',
  },
  deals: {
    title: 'Deals Pipeline Help',
    description: 'Visual pipeline showing all deals by stage. Move deals and get AI recommendations.',
    tips: [
      'Click a deal card to open details and AI suggestions',
      '"Move to stage" buttons appear on hover',
      'ARAS AI can suggest next steps for any deal',
      'Total value shown per stage for quick overview',
    ],
    troubleshooting: 'If deals are stuck, check the API connection in the console.',
  },
  tasks: {
    title: 'Tasks Help',
    description: 'Your to-do list with status tracking and due date management.',
    tips: [
      'Click the circle to mark tasks as done',
      'Overdue tasks are highlighted in red',
      'Use filters to focus on specific status',
      'Tasks can be linked to contacts and deals',
    ],
    troubleshooting: 'Tasks not saving? Check your network and try again.',
  },
  calls: {
    title: 'Call Logs Help',
    description: 'View all call history with sentiment analysis and recordings.',
    tips: [
      'Filter by time range (24h, 48h, 7d, all)',
      'Sentiment badges show call outcome quality',
      'Click play icon to listen to recordings (if available)',
      'Summary text is AI-generated from call content',
    ],
    troubleshooting: 'Missing calls? Check if your phone integration is properly configured.',
  },
};

export default HintButton;
