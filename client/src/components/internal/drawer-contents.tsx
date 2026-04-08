/**
 * ============================================================================
 * DRAWER CONTENT COMPONENTS - Team Command Center Details
 * ============================================================================
 * Content components for each drawer type in the Command Center
 * ============================================================================
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, Calendar, Clock, MessageSquare, Building2, Users, FileText,
  CheckSquare, Phone, TrendingUp, Send, Check, X, AlertCircle,
  Mail, MapPin, Briefcase, Activity, ExternalLink
} from 'lucide-react';
import { 
  DrawerSection, DrawerInfoRow, DrawerActionButton, 
  DrawerBadge, DrawerTimelineItem 
} from './aras-drawer';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// FEED ITEM DRAWER CONTENT
// ============================================================================

interface FeedItem {
  id: number;
  authorUserId: string;
  authorUsername: string;
  type: string;
  message: string;
  category?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  createdAt: string;
}

interface FeedItemDrawerProps {
  item: FeedItem;
  onOpenInCRM?: (type: string, id: string) => void;
  onViewProfile?: (userId: string) => void;
}

export function FeedItemDrawerContent({ item, onOpenInCRM, onViewProfile }: FeedItemDrawerProps) {
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const typeLabels: Record<string, { label: string; icon: any; color: string }> = {
    note: { label: 'Team Update', icon: MessageSquare, color: 'orange' },
    update: { label: 'Status Update', icon: Activity, color: 'blue' },
    announcement: { label: 'Announcement', icon: AlertCircle, color: 'yellow' },
    contact_created: { label: 'Contact Created', icon: Users, color: 'green' },
    contact_updated: { label: 'Contact Updated', icon: Users, color: 'blue' },
    company_created: { label: 'Company Created', icon: Building2, color: 'green' },
    deal_created: { label: 'Deal Created', icon: TrendingUp, color: 'green' },
    deal_moved: { label: 'Deal Moved', icon: TrendingUp, color: 'blue' },
    task_created: { label: 'Task Created', icon: CheckSquare, color: 'green' },
    task_done: { label: 'Task Completed', icon: Check, color: 'green' },
    contract_pending: { label: 'Contract Pending', icon: FileText, color: 'yellow' },
    contract_approved: { label: 'Contract Approved', icon: FileText, color: 'green' },
    call_logged: { label: 'Call Logged', icon: Phone, color: 'blue' },
  };

  const typeInfo = typeLabels[item.type] || typeLabels.note;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-5">
      {/* What Happened */}
      <DrawerSection>
        <div 
          className="p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(254,145,0,0.1)' }}
            >
              <TypeIcon className="w-5 h-5" style={{ color: '#FE9100' }} />
            </div>
            <div className="flex-1 min-w-0">
              <DrawerBadge color={typeInfo.color as any}>{typeInfo.label}</DrawerBadge>
              <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {item.message}
              </p>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Meta Information */}
      <DrawerSection title="Details">
        <DrawerInfoRow 
          label="Posted by" 
          value={
            <button 
              onClick={() => onViewProfile?.(item.authorUserId)}
              className="flex items-center gap-2 hover:text-orange-400 transition-colors"
            >
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{ background: 'linear-gradient(135deg, #FE9100, #a34e00)', color: 'white' }}
              >
                {item.authorUsername?.[0]?.toUpperCase()}
              </div>
              {item.authorUsername}
            </button>
          }
          icon={<User className="w-3.5 h-3.5" />}
        />
        <DrawerInfoRow 
          label="Time" 
          value={format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm')}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        {item.category && (
          <DrawerInfoRow 
            label="Category" 
            value={<DrawerBadge color="orange">{item.category}</DrawerBadge>}
          />
        )}
      </DrawerSection>

      {/* Related Entity */}
      {item.targetType && item.targetId && (
        <DrawerSection title="Related">
          <button
            onClick={() => onOpenInCRM?.(item.targetType!, item.targetId!)}
            className="w-full p-3 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.01]"
            style={{ 
              background: 'rgba(254,145,0,0.05)', 
              border: '1px solid rgba(254,145,0,0.15)' 
            }}
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(254,145,0,0.1)' }}
            >
              {item.targetType === 'contact' && <Users className="w-5 h-5" style={{ color: '#FE9100' }} />}
              {item.targetType === 'company' && <Building2 className="w-5 h-5" style={{ color: '#FE9100' }} />}
              {item.targetType === 'deal' && <TrendingUp className="w-5 h-5" style={{ color: '#FE9100' }} />}
              {item.targetType === 'contract' && <FileText className="w-5 h-5" style={{ color: '#FE9100' }} />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {item.targetName || `${item.targetType} #${item.targetId}`}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Click to view in CRM
              </p>
            </div>
            <ExternalLink className="w-4 h-4" style={{ color: '#FE9100' }} />
          </button>
        </DrawerSection>
      )}

      {/* Comment Section */}
      <DrawerSection title="Add Comment">
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
            }}
          />
          <button
            onClick={() => {
              if (comment.trim()) {
                toast({ title: '✓ Comment added' });
                setComment('');
              }
            }}
            disabled={!comment.trim()}
            className="px-3 py-2 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </DrawerSection>
    </div>
  );
}

// ============================================================================
// CALENDAR EVENT DRAWER CONTENT
// ============================================================================

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
  color?: string;
  createdByUserId?: string;
  creatorUsername?: string;
}

interface CalendarEventDrawerProps {
  event: CalendarEvent;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateTask?: () => void;
}

export function CalendarEventDrawerContent({ 
  event, 
  onEdit, 
  onDelete, 
  onCreateTask 
}: CalendarEventDrawerProps) {
  return (
    <div className="space-y-5">
      {/* Event Header */}
      <DrawerSection>
        <div 
          className="p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="w-2 h-12 rounded-full"
              style={{ background: event.color || '#FE9100' }}
            />
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {event.title}
              </h3>
              {event.description && (
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Event Details */}
      <DrawerSection title="When">
        <DrawerInfoRow 
          label="Date" 
          value={format(new Date(event.startsAt), 'EEEE, dd. MMMM yyyy', { locale: de })}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        {!event.allDay && (
          <DrawerInfoRow 
            label="Time" 
            value={`${format(new Date(event.startsAt), 'HH:mm')}${event.endsAt ? ` - ${format(new Date(event.endsAt), 'HH:mm')}` : ''}`}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        )}
        {event.allDay && (
          <DrawerInfoRow 
            label="Duration" 
            value={<DrawerBadge color="blue">All Day</DrawerBadge>}
          />
        )}
      </DrawerSection>

      {event.location && (
        <DrawerSection title="Where">
          <DrawerInfoRow 
            label="Location" 
            value={event.location}
            icon={<MapPin className="w-3.5 h-3.5" />}
          />
        </DrawerSection>
      )}

      {event.creatorUsername && (
        <DrawerSection title="Organizer">
          <DrawerInfoRow 
            label="Created by" 
            value={event.creatorUsername}
            icon={<User className="w-3.5 h-3.5" />}
          />
        </DrawerSection>
      )}

      {/* Actions */}
      <DrawerSection title="Actions">
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <DrawerActionButton onClick={onEdit} variant="secondary">
              Edit Event
            </DrawerActionButton>
          )}
          {onCreateTask && (
            <DrawerActionButton onClick={onCreateTask} variant="primary" icon={<CheckSquare className="w-3 h-3" />}>
              Create Task
            </DrawerActionButton>
          )}
          {onDelete && (
            <DrawerActionButton onClick={onDelete} variant="danger" icon={<X className="w-3 h-3" />}>
              Delete
            </DrawerActionButton>
          )}
        </div>
      </DrawerSection>
    </div>
  );
}

// ============================================================================
// TODO DRAWER CONTENT
// ============================================================================

interface Todo {
  id: number;
  title: string;
  description?: string;
  dueAt?: string;
  priority: string;
  status: string;
  assignedToUserId?: string;
  assignedUsername?: string;
  createdByUserId?: string;
  createdAt?: string;
}

interface TodoDrawerProps {
  todo: Todo;
  onToggleStatus?: (done: boolean) => void;
  onAssign?: (userId: string) => void;
  onChangeDue?: (date: string) => void;
}

export function TodoDrawerContent({ 
  todo, 
  onToggleStatus,
  onAssign,
  onChangeDue,
}: TodoDrawerProps) {
  const priorityColors: Record<string, 'red' | 'orange' | 'yellow' | 'gray'> = {
    critical: 'red',
    high: 'orange',
    medium: 'yellow',
    low: 'gray',
  };

  const statusColors: Record<string, 'green' | 'yellow' | 'gray'> = {
    done: 'green',
    in_progress: 'yellow',
    pending: 'gray',
  };

  return (
    <div className="space-y-5">
      {/* Task Header */}
      <DrawerSection>
        <div 
          className="p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start gap-3">
            <button
              onClick={() => onToggleStatus?.(todo.status !== 'done')}
              className="w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
              style={{ 
                borderColor: todo.status === 'done' ? '#10B981' : 'rgba(255,255,255,0.3)',
                background: todo.status === 'done' ? '#10B981' : 'transparent',
              }}
            >
              {todo.status === 'done' && <Check className="w-4 h-4 text-white" />}
            </button>
            <div>
              <h3 
                className="text-base font-medium"
                style={{ 
                  color: todo.status === 'done' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)',
                  textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                }}
              >
                {todo.title}
              </h3>
              {todo.description && (
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {todo.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Task Details */}
      <DrawerSection title="Details">
        <DrawerInfoRow 
          label="Status" 
          value={<DrawerBadge color={statusColors[todo.status] || 'gray'}>{todo.status.replace('_', ' ')}</DrawerBadge>}
        />
        <DrawerInfoRow 
          label="Priority" 
          value={<DrawerBadge color={priorityColors[todo.priority] || 'gray'}>{todo.priority}</DrawerBadge>}
        />
        {todo.dueAt && (
          <DrawerInfoRow 
            label="Due" 
            value={format(new Date(todo.dueAt), 'dd.MM.yyyy HH:mm')}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        )}
        {todo.assignedUsername && (
          <DrawerInfoRow 
            label="Assigned to" 
            value={todo.assignedUsername}
            icon={<User className="w-3.5 h-3.5" />}
          />
        )}
      </DrawerSection>

      {/* Quick Actions */}
      <DrawerSection title="Quick Actions">
        <div className="flex flex-wrap gap-2">
          <DrawerActionButton 
            onClick={() => onToggleStatus?.(todo.status !== 'done')} 
            variant={todo.status === 'done' ? 'secondary' : 'primary'}
            icon={todo.status === 'done' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
          >
            {todo.status === 'done' ? 'Mark Incomplete' : 'Mark Complete'}
          </DrawerActionButton>
        </div>
      </DrawerSection>

      {/* Activity Timeline */}
      <DrawerSection title="Activity">
        <div className="space-y-0">
          <DrawerTimelineItem 
            title="Task created"
            timestamp={todo.createdAt ? format(new Date(todo.createdAt), 'dd.MM.yyyy HH:mm') : 'Unknown'}
            icon={<CheckSquare className="w-4 h-4" style={{ color: '#FE9100' }} />}
            isLast={todo.status !== 'done'}
          />
          {todo.status === 'done' && (
            <DrawerTimelineItem 
              title="Task completed"
              timestamp="Just now"
              icon={<Check className="w-4 h-4" style={{ color: '#10B981' }} />}
              isLast
            />
          )}
        </div>
      </DrawerSection>
    </div>
  );
}

// ============================================================================
// USER PROFILE DRAWER CONTENT
// ============================================================================

interface TeamUser {
  id: string;
  username: string;
  userRole: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface UserProfileDrawerProps {
  user: TeamUser;
  onSendMessage?: () => void;
  onAssignTask?: () => void;
}

export function UserProfileDrawerContent({ 
  user, 
  onSendMessage,
  onAssignTask,
}: UserProfileDrawerProps) {
  const roleColors: Record<string, 'orange' | 'blue' | 'gray'> = {
    admin: 'orange',
    staff: 'blue',
    user: 'gray',
  };

  return (
    <div className="space-y-5">
      {/* Profile Header */}
      <DrawerSection>
        <div className="flex flex-col items-center text-center py-4">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-3"
            style={{ 
              background: 'linear-gradient(135deg, #FE9100, #a34e00)', 
              color: 'white',
              boxShadow: '0 4px 20px rgba(254,145,0,0.3)',
            }}
          >
            {user.username?.[0]?.toUpperCase()}
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.username}
          </h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            @{user.username}
          </p>
          <div className="mt-2">
            <DrawerBadge color={roleColors[user.userRole] || 'gray'}>
              {user.userRole}
            </DrawerBadge>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Online</span>
          </div>
        </div>
      </DrawerSection>

      {/* Contact Info */}
      {user.email && (
        <DrawerSection title="Contact">
          <DrawerInfoRow 
            label="Email" 
            value={user.email}
            icon={<Mail className="w-3.5 h-3.5" />}
          />
        </DrawerSection>
      )}

      {/* Quick Actions */}
      <DrawerSection title="Quick Actions">
        <div className="flex flex-wrap gap-2">
          {onSendMessage && (
            <DrawerActionButton 
              onClick={onSendMessage} 
              variant="primary"
              icon={<MessageSquare className="w-3 h-3" />}
            >
              Send Message
            </DrawerActionButton>
          )}
          {onAssignTask && (
            <DrawerActionButton 
              onClick={onAssignTask} 
              variant="secondary"
              icon={<CheckSquare className="w-3 h-3" />}
            >
              Assign Task
            </DrawerActionButton>
          )}
        </div>
      </DrawerSection>
    </div>
  );
}

// ============================================================================
// CONTRACT DRAWER CONTENT
// ============================================================================

interface Contract {
  id: string;
  title?: string;
  filename?: string;
  status: string;
  assignedUsername?: string;
  uploadedByName?: string;
  createdAt?: string;
}

interface ContractDrawerProps {
  contract: Contract;
  isAdmin?: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onViewPDF?: () => void;
}

export function ContractDrawerContent({ 
  contract, 
  isAdmin = false,
  onApprove,
  onReject,
  onViewPDF,
}: ContractDrawerProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const statusColors: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
    pending: 'yellow',
    pending_approval: 'yellow',
    approved: 'green',
    rejected: 'red',
    uploaded: 'gray',
  };

  return (
    <div className="space-y-5">
      {/* Contract Header */}
      <DrawerSection>
        <div 
          className="p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(254,145,0,0.1)' }}
            >
              <FileText className="w-6 h-6" style={{ color: '#FE9100' }} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {contract.title || contract.filename || 'Contract'}
              </h3>
              <div className="mt-1">
                <DrawerBadge color={statusColors[contract.status] || 'gray'}>
                  {contract.status.replace('_', ' ')}
                </DrawerBadge>
              </div>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Contract Details */}
      <DrawerSection title="Details">
        {contract.assignedUsername && (
          <DrawerInfoRow 
            label="Assigned to" 
            value={contract.assignedUsername}
            icon={<User className="w-3.5 h-3.5" />}
          />
        )}
        {contract.uploadedByName && (
          <DrawerInfoRow 
            label="Uploaded by" 
            value={contract.uploadedByName}
            icon={<User className="w-3.5 h-3.5" />}
          />
        )}
        {contract.createdAt && (
          <DrawerInfoRow 
            label="Created" 
            value={format(new Date(contract.createdAt), 'dd.MM.yyyy HH:mm')}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        )}
      </DrawerSection>

      {/* Status Timeline */}
      <DrawerSection title="Status Timeline">
        <div className="space-y-0">
          <DrawerTimelineItem 
            title="Contract uploaded"
            timestamp={contract.createdAt ? format(new Date(contract.createdAt), 'dd.MM.yyyy') : 'Unknown'}
            icon={<FileText className="w-4 h-4" style={{ color: '#FE9100' }} />}
          />
          <DrawerTimelineItem 
            title="Pending approval"
            timestamp="Current"
            icon={<Clock className="w-4 h-4" style={{ color: '#EAB308' }} />}
            isLast={contract.status === 'pending' || contract.status === 'pending_approval'}
          />
          {contract.status === 'approved' && (
            <DrawerTimelineItem 
              title="Approved"
              timestamp="Completed"
              icon={<Check className="w-4 h-4" style={{ color: '#10B981' }} />}
              isLast
            />
          )}
        </div>
      </DrawerSection>

      {/* Admin Actions */}
      {isAdmin && (contract.status === 'pending' || contract.status === 'pending_approval') && (
        <DrawerSection title="Admin Actions">
          {!showRejectInput ? (
            <div className="flex flex-wrap gap-2">
              <DrawerActionButton 
                onClick={() => onApprove?.()} 
                variant="primary"
                icon={<Check className="w-3 h-3" />}
              >
                Approve Contract
              </DrawerActionButton>
              <DrawerActionButton 
                onClick={() => setShowRejectInput(true)} 
                variant="danger"
                icon={<X className="w-3 h-3" />}
              >
                Reject
              </DrawerActionButton>
              {onViewPDF && (
                <DrawerActionButton 
                  onClick={onViewPDF} 
                  variant="secondary"
                  icon={<ExternalLink className="w-3 h-3" />}
                >
                  View PDF
                </DrawerActionButton>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ 
                  background: 'rgba(239,68,68,0.1)', 
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <div className="flex gap-2">
                <DrawerActionButton 
                  onClick={() => {
                    if (rejectReason.trim()) {
                      onReject?.(rejectReason);
                    }
                  }} 
                  variant="danger"
                  disabled={!rejectReason.trim()}
                >
                  Confirm Reject
                </DrawerActionButton>
                <DrawerActionButton 
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason('');
                  }} 
                  variant="secondary"
                >
                  Cancel
                </DrawerActionButton>
              </div>
            </div>
          )}
        </DrawerSection>
      )}
    </div>
  );
}

// ============================================================================
// ACTION ITEM DRAWER CONTENT
// ============================================================================

interface ActionItem {
  id: number;
  title: string;
  dueAt?: string;
  priority: string;
  type: string;
  entityType?: string;
  entityId?: string;
}

interface ActionItemDrawerProps {
  action: ActionItem;
  onExecute?: () => void;
  onSnooze?: (duration: string) => void;
}

export function ActionItemDrawerContent({ 
  action, 
  onExecute,
  onSnooze,
}: ActionItemDrawerProps) {
  const typeLabels: Record<string, { label: string; description: string }> = {
    todo: { label: 'Task', description: 'A task that needs attention' },
    event: { label: 'Event', description: 'An upcoming calendar event' },
    overdue: { label: 'Overdue', description: 'This item is past its due date' },
    contract: { label: 'Contract', description: 'Contract awaiting action' },
    deal: { label: 'Deal', description: 'Deal needs next step' },
    callback: { label: 'Callback', description: 'Follow-up call required' },
  };

  const typeInfo = typeLabels[action.type] || typeLabels.todo;

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <DrawerSection>
        <div 
          className="p-4 rounded-xl"
          style={{ 
            background: 'linear-gradient(135deg, rgba(254,145,0,0.1), rgba(163,78,0,0.05))', 
            border: '1px solid rgba(254,145,0,0.2)' 
          }}
        >
          <DrawerBadge color="orange">{typeInfo.label}</DrawerBadge>
          <h3 className="text-base font-semibold mt-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {action.title}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {typeInfo.description}
          </p>
        </div>
      </DrawerSection>

      {/* Why This Action */}
      <DrawerSection title="Why This Action">
        <div 
          className="p-3 rounded-lg text-sm"
          style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)' }}
        >
          {action.dueAt && new Date(action.dueAt) < new Date() 
            ? `This item is overdue since ${format(new Date(action.dueAt), 'dd.MM.yyyy')}`
            : action.dueAt 
              ? `Due ${formatDistanceToNow(new Date(action.dueAt), { addSuffix: true })}`
              : 'Requires your attention'
          }
        </div>
      </DrawerSection>

      {/* Details */}
      <DrawerSection title="Details">
        {action.dueAt && (
          <DrawerInfoRow 
            label="Due" 
            value={format(new Date(action.dueAt), 'dd.MM.yyyy HH:mm')}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        )}
        <DrawerInfoRow 
          label="Priority" 
          value={
            <DrawerBadge color={action.priority === 'high' ? 'red' : action.priority === 'medium' ? 'yellow' : 'gray'}>
              {action.priority}
            </DrawerBadge>
          }
        />
      </DrawerSection>

      {/* Actions */}
      <DrawerSection title="Take Action">
        <div className="flex flex-wrap gap-2">
          {onExecute && (
            <DrawerActionButton 
              onClick={onExecute} 
              variant="primary"
              icon={<ExternalLink className="w-3 h-3" />}
            >
              Do It Now
            </DrawerActionButton>
          )}
          {onSnooze && (
            <>
              <DrawerActionButton 
                onClick={() => onSnooze('1h')} 
                variant="secondary"
              >
                Snooze 1h
              </DrawerActionButton>
              <DrawerActionButton 
                onClick={() => onSnooze('1d')} 
                variant="secondary"
              >
                Snooze 1 day
              </DrawerActionButton>
            </>
          )}
        </div>
      </DrawerSection>
    </div>
  );
}

export default {
  FeedItemDrawerContent,
  CalendarEventDrawerContent,
  TodoDrawerContent,
  UserProfileDrawerContent,
  ContractDrawerContent,
  ActionItemDrawerContent,
};
