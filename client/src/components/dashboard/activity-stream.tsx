/**
 * ARAS Mission Control - Activity Stream
 * Real-time activity feed with typed events
 * Premium ARAS CI design
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, PhoneOff, PhoneIncoming, Megaphone, Users, 
  MessageSquare, Database, AlertTriangle, CheckCircle,
  Clock, Zap, Info, Upload, XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { ActivityItem, ActivityType } from '@/lib/dashboard/overview.schema';
import { useActionDispatch } from '@/lib/actions/dispatch';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

// Activity type config
const activityConfig: Record<ActivityType, { icon: React.ReactNode; color: string; label: string }> = {
  call_started: { icon: <PhoneIncoming size={14} />, color: '#3b82f6', label: 'Call gestartet' },
  call_completed: { icon: <Phone size={14} />, color: '#22c55e', label: 'Call abgeschlossen' },
  call_failed: { icon: <PhoneOff size={14} />, color: '#ef4444', label: 'Call fehlgeschlagen' },
  campaign_started: { icon: <Megaphone size={14} />, color: '#f59e0b', label: 'Kampagne gestartet' },
  campaign_paused: { icon: <Clock size={14} />, color: '#6b7280', label: 'Kampagne pausiert' },
  campaign_completed: { icon: <CheckCircle size={14} />, color: '#22c55e', label: 'Kampagne abgeschlossen' },
  contact_added: { icon: <Users size={14} />, color: '#22c55e', label: 'Kontakt hinzugefügt' },
  contact_enriched: { icon: <Zap size={14} />, color: '#8b5cf6', label: 'Kontakt angereichert' },
  kb_uploaded: { icon: <Upload size={14} />, color: '#3b82f6', label: 'Quelle hochgeladen' },
  kb_error: { icon: <XCircle size={14} />, color: '#ef4444', label: 'KB Fehler' },
  space_created: { icon: <MessageSquare size={14} />, color: '#3b82f6', label: 'Space erstellt' },
  space_message: { icon: <MessageSquare size={14} />, color: '#e9d7c4', label: 'Neue Nachricht' },
  task_created: { icon: <CheckCircle size={14} />, color: '#f59e0b', label: 'Aufgabe erstellt' },
  task_completed: { icon: <CheckCircle size={14} />, color: '#22c55e', label: 'Aufgabe erledigt' },
  system_alert: { icon: <AlertTriangle size={14} />, color: '#ef4444', label: 'System Alert' },
  system_info: { icon: <Info size={14} />, color: '#3b82f6', label: 'System Info' },
};

interface ActivityStreamProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  maxItems?: number;
}

function ActivityItemRow({ activity, index }: { activity: ActivityItem; index: number }) {
  const dispatch = useActionDispatch();
  const config = activityConfig[activity.type] || activityConfig.system_info;
  
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { 
    addSuffix: true, 
    locale: de 
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="flex items-start gap-3 py-3 group"
    >
      {/* Timeline dot */}
      <div className="relative flex flex-col items-center">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{ 
            background: `${config.color}15`,
            color: config.color,
          }}
        >
          {config.icon}
        </div>
        {/* Connector line */}
        <div 
          className="w-px flex-1 mt-2 hidden group-last:hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-white/80">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">
                {activity.description}
              </p>
            )}
          </div>
          
          <span className="text-[9px] text-white/30 whitespace-nowrap shrink-0">
            {timeAgo}
          </span>
        </div>

        {/* Action button if actionable */}
        {activity.actionable && activity.actionCta && (
          <button
            onClick={() => dispatch(activity.actionCta!)}
            className="mt-2 text-[10px] font-medium px-2 py-1 rounded transition-colors"
            style={{ 
              background: `${config.color}15`,
              color: config.color,
            }}
          >
            {activity.actionCta.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div 
        className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <Clock size={20} className="text-white/30" />
      </div>
      <p className="text-[11px] text-white/40">
        Noch keine Aktivitäten
      </p>
      <p className="text-[10px] text-white/25 mt-1">
        Deine Aktionen werden hier angezeigt
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="flex-1 pt-1">
            <div className="h-3 w-32 bg-white/10 rounded mb-2" />
            <div className="h-2.5 w-48 bg-white/5 rounded" />
          </div>
          <div className="h-2 w-12 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ActivityStream({ activities, isLoading, maxItems = 10 }: ActivityStreamProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <h3 
            className="text-sm font-bold uppercase tracking-wide"
            style={{
              background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aktivitäten
          </h3>
          
          <span className="text-[10px] text-white/40 font-medium">
            Letzte {maxItems}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-2 max-h-[350px] overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : displayedActivities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {displayedActivities.map((activity, index) => (
                <ActivityItemRow key={activity.id} activity={activity} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer - show more link if truncated */}
      {activities.length > maxItems && (
        <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <button className="text-[10px] text-white/40 hover:text-white/60 transition-colors">
            Alle {activities.length} Aktivitäten anzeigen →
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default ActivityStream;
