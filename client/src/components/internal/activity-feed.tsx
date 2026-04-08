/**
 * ============================================================================
 * ARAS COMMAND CENTER - Activity Feed
 * ============================================================================
 * Shows recent activity from the adminActivityLog
 * Real data, no fake entries
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Activity, Clock, User, Building2, TrendingUp, CheckSquare, 
  Phone, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { apiGet } from '@/lib/api';

interface ActivityItem {
  id: number;
  actorId: string;
  actorName?: string;
  action: string;
  actionCategory: string;
  actionIcon: string;
  actionColor: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  title: string;
  description?: string;
  createdAt: string;
  aiInsight?: string;
  aiPriority?: string;
}

const ICON_MAP: Record<string, typeof Activity> = {
  Eye: Activity,
  UserCog: User,
  UserX: User,
  UserPlus: User,
  TrendingUp: TrendingUp,
  CheckCircle: CheckSquare,
  Phone: Phone,
  Building: Building2,
  default: Activity,
};

interface ActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
}

export function ActivityFeed({ limit = 10, showHeader = true }: ActivityFeedProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/admin/activity', limit],
    queryFn: async () => {
      const result = await apiGet<{ data: ActivityItem[]; total: number }>(`/api/admin/activity?limit=${limit}`);
      if (!result.ok) throw result.error;
      return result.data || { data: [], total: 0 };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const activities = data?.data || [];

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || ICON_MAP.default;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" />
              Recent Activity
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-8 px-2 text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showHeader ? '' : 'pt-6'}>
        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load activity</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 bg-white/10 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && activities.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-10 h-10 mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400 text-sm">No recent activity</p>
            <p className="text-gray-500 text-xs mt-1">
              Activities will appear here as you use the system
            </p>
          </div>
        )}

        {/* Activity List */}
        {!isLoading && activities.length > 0 && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-4 bottom-4 w-px bg-white/10" />

            <div className="space-y-4">
              {activities.map((activity, idx) => {
                const Icon = getIcon(activity.actionIcon);
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-3 relative"
                  >
                    {/* Icon */}
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                      style={{ backgroundColor: `${activity.actionColor}20` }}
                    >
                      <Icon 
                        className="w-4 h-4" 
                        style={{ color: activity.actionColor }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">
                          {activity.title}
                        </span>
                        {activity.aiPriority && activity.aiPriority !== 'low' && (
                          <span className={`w-2 h-2 rounded-full ${getPriorityColor(activity.aiPriority)}`} />
                        )}
                      </div>
                      
                      {activity.targetName && (
                        <p className="text-xs text-gray-400 truncate">
                          {activity.targetName}
                        </p>
                      )}
                      
                      {activity.aiInsight && (
                        <p className="text-xs text-orange-400/80 mt-1 italic">
                          {activity.aiInsight}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(new Date(activity.createdAt), { 
                            addSuffix: true,
                            locale: de 
                          })}
                        </span>
                        {activity.actorName && (
                          <>
                            <span>•</span>
                            <span>{activity.actorName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityFeed;
