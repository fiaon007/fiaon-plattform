/**
 * ============================================================================
 * ARAS COMMAND CENTER - CALL LOGS
 * ============================================================================
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Phone, AlertCircle, RefreshCw, Clock, PlayCircle, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useArasDebug, useArasDebugMount } from "@/hooks/useArasDebug";
import { apiGet } from "@/lib/api";

type CallSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
type CallSource = "RETELL" | "ELEVENLABS" | "TWILIO" | "OTHER";

interface CallLog {
  id: string;
  contactId?: string;
  source: CallSource;
  externalCallId?: string;
  phoneNumber?: string;
  timestamp: string;
  durationSeconds?: number;
  outcome?: string;
  sentiment?: CallSentiment;
  summary?: string;
  recordingUrl?: string;
  createdAt: string;
}

const SENTIMENT_CONFIG: Record<CallSentiment, { icon: typeof ThumbsUp; color: string; label: string }> = {
  POSITIVE: { icon: ThumbsUp, color: 'text-green-400', label: 'Positive' },
  NEUTRAL: { icon: Minus, color: 'text-gray-400', label: 'Neutral' },
  NEGATIVE: { icon: ThumbsDown, color: 'text-red-400', label: 'Negative' },
  MIXED: { icon: Minus, color: 'text-yellow-400', label: 'Mixed' },
};

const SOURCE_COLORS: Record<CallSource, string> = {
  RETELL: 'bg-purple-500/20 text-purple-400',
  ELEVENLABS: 'bg-blue-500/20 text-blue-400',
  TWILIO: 'bg-red-500/20 text-red-400',
  OTHER: 'bg-gray-500/20 text-gray-400',
};

export default function InternalCalls() {
  const [hoursFilter, setHoursFilter] = useState<number | null>(24);

  useArasDebugMount('InternalCalls', '/internal/calls');

  const { data: calls, isLoading, error, status, refetch } = useQuery({
    queryKey: ['/api/internal/calls', hoursFilter],
    queryFn: async () => {
      const url = hoursFilter 
        ? `/api/internal/calls?hours=${hoursFilter}`
        : '/api/internal/calls';
      const result = await apiGet<CallLog[]>(url);
      if (!result.ok) throw result.error;
      return result.data || [];
    }
  });

  useArasDebug({
    route: '/internal/calls',
    queryKey: ['/api/internal/calls', String(hoursFilter)],
    status: status as any,
    data: calls,
    error,
    componentName: 'InternalCalls'
  });

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '–';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Phone className="w-6 h-6 text-orange-400" />
              Call Logs
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {calls?.length || 0} calls {hoursFilter ? `in last ${hoursFilter}h` : 'total'}
            </p>
          </div>
          <div className="flex gap-2">
            {[24, 48, 168, null].map((hours) => (
              <Button
                key={hours ?? 'all'}
                variant={hoursFilter === hours ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHoursFilter(hours)}
                className={hoursFilter === hours ? 'bg-orange-500' : ''}
              >
                {hours === null ? 'All' : hours === 168 ? '7d' : `${hours}h`}
              </Button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Error loading calls: {(error as Error).message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Calls List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : !calls || calls.length === 0 ? (
            <Card className="bg-white/5 border-white/10 border-dashed">
              <CardContent className="p-12 text-center">
                <Phone className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Call Logs</h3>
                <p className="text-gray-400">
                  {hoursFilter ? `No calls in the last ${hoursFilter} hours` : 'No calls recorded yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            calls.map((call, idx) => {
              const sentimentConfig = call.sentiment ? SENTIMENT_CONFIG[call.sentiment] : null;
              const SentimentIcon = sentimentConfig?.icon || Minus;
              
              return (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Phone className="w-5 h-5 text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">
                              {call.phoneNumber || 'Unknown Number'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[call.source]}`}>
                              {call.source}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(call.timestamp)}
                            </span>
                            {call.durationSeconds && (
                              <span>{formatDuration(call.durationSeconds)}</span>
                            )}
                            {call.outcome && (
                              <span className="text-gray-500">{call.outcome}</span>
                            )}
                          </div>

                          {call.summary && (
                            <p className="text-sm text-gray-300 line-clamp-2">{call.summary}</p>
                          )}
                        </div>

                        {/* Sentiment & Actions */}
                        <div className="flex items-center gap-3">
                          {sentimentConfig && (
                            <div className={`flex items-center gap-1 ${sentimentConfig.color}`}>
                              <SentimentIcon className="w-4 h-4" />
                              <span className="text-xs">{sentimentConfig.label}</span>
                            </div>
                          )}
                          
                          {call.recordingUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(call.recordingUrl, '_blank')}
                            >
                              <PlayCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </InternalLayout>
  );
}
