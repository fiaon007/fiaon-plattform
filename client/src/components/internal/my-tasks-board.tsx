/**
 * ============================================================================
 * MY TASKS BOARD v3.1 - ULTRA PREMIUM 2026
 * ============================================================================
 * Schwarzott Group · Executive Level · Command Center
 * Build: 2026-02-04T19:11
 * 
 * - NO Drag & Drop (bewusste Statuswechsel)
 * - Premium Glassmorphism (rgba(0,0,0,0.42) + blur 18px)
 * - Portal-based Drawer (position: fixed, 560px)
 * - Move-Menü statt Kanban-Kitsch
 * - 12-Column Grid (8/4 Split)
 * ============================================================================
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Filter, MoreHorizontal, Check, Info, X, Loader2,
  Calendar, Clock, CheckCircle2, Inbox, ExternalLink,
  RotateCcw, ChevronDown
} from 'lucide-react';
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

interface InternalTask {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  dueDate?: string | null;
  assignedUserId?: string | null;
  relatedContactId?: string | null;
  relatedDealId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type ColumnId = 'inbox' | 'open' | 'done';

interface Column {
  id: ColumnId;
  title: string;
  icon: React.ElementType;
  description: string;
}

const COLUMNS: Column[] = [
  { id: 'inbox', title: 'EINGANG', icon: Inbox, description: 'Neue Aufgaben ohne Termin. Ihr Posteingang für alles, was noch keinen festen Platz hat.' },
  { id: 'open', title: 'OFFEN', icon: Clock, description: 'Aktive Aufgaben mit Termin. Hier sind alle Aufgaben, die bearbeitet werden müssen.' },
  { id: 'done', title: 'ERLEDIGT', icon: CheckCircle2, description: 'Abgeschlossene Aufgaben. Ihre Erfolge auf einen Blick.' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTaskColumn(task: InternalTask): ColumnId {
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return 'done';
  }
  
  // Tasks without due date go to inbox
  if (!task.dueDate) {
    return 'inbox';
  }
  
  // Tasks with due date go to open
  return 'open';
}

// ============================================================================
// TASK CARD COMPONENT (No Drag & Drop - Move Menu Instead)
// ============================================================================

interface TaskCardProps {
  task: InternalTask;
  currentColumn: ColumnId;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onMove: (taskId: string, columnId: ColumnId) => void;
  onClick: (task: InternalTask) => void;
}

function TaskCard({ task, currentColumn, onComplete, onReopen, onMove, onClick }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const getPriorityColor = () => {
    if (task.status === 'DONE') return 'rgba(107,114,128,0.6)';
    if (!task.dueDate) return 'rgba(107,114,128,0.6)';
    
    const dueDate = new Date(task.dueDate);
    if (isBefore(dueDate, startOfDay(new Date()))) return '#EF4444';
    if (isToday(dueDate)) return '#F97316';
    if (isTomorrow(dueDate)) return '#EAB308';
    return 'rgba(107,114,128,0.6)';
  };
  
  const formatDueDate = () => {
    if (!task.dueDate) return 'Kein Termin';
    const date = new Date(task.dueDate);
    if (isToday(date)) return `Heute, ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Morgen, ${format(date, 'HH:mm')}`;
    return format(date, 'EEE, dd.MM', { locale: de });
  };

  const showMenu = isHovered || menuOpen;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(task)}
      className="group cursor-pointer transition-all duration-150"
      style={{
        borderRadius: '14px',
        padding: '14px',
        background: isHovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header Row */}
      <div className="flex items-start gap-2 mb-2">
        <p 
          className="flex-1 text-[14px] font-semibold leading-tight line-clamp-2"
          style={{ 
            color: task.status === 'DONE' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
            textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        
        {/* Move Menu Button */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 outline-none focus:ring-2 focus:ring-[#ff6a00]/60"
              style={{
                opacity: showMenu ? 1 : 0,
                pointerEvents: showMenu ? 'auto' : 'none',
                background: menuOpen ? 'rgba(255,106,0,0.15)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!menuOpen) e.currentTarget.style.background = 'rgba(255,106,0,0.10)';
              }}
              onMouseLeave={(e) => {
                if (!menuOpen) e.currentTarget.style.background = 'transparent';
              }}
            >
              <MoreHorizontal className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            onClick={(e) => e.stopPropagation()}
            className="w-[240px] p-1.5 border-0"
            style={{
              borderRadius: '14px',
              background: 'rgba(0,0,0,0.94)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 20px 70px rgba(0,0,0,0.8)',
            }}
          >
            <DropdownMenuItem
              onClick={() => onClick(task)}
              className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              <ExternalLink className="w-4 h-4 mr-2" style={{ color: 'rgba(255,255,255,0.5)' }} />
              Öffnen
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-1.5 bg-white/10" />
            
            <DropdownMenuLabel className="px-3 py-1.5 text-[11px] font-normal uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Verschieben nach
            </DropdownMenuLabel>
            
            {COLUMNS.filter(col => col.id !== 'done').map((col) => {
              const isActive = currentColumn === col.id;
              const Icon = col.icon;
              return (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() => onMove(task.id, col.id)}
                  className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer relative"
                  style={{ 
                    color: isActive ? '#e9d7c4' : 'rgba(255,255,255,0.85)',
                    background: isActive ? 'rgba(255,106,0,0.08)' : 'transparent',
                  }}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[#ff6a00]" />
                  )}
                  <Icon className="w-4 h-4 mr-2" style={{ color: isActive ? '#FE9100' : 'rgba(255,255,255,0.5)' }} />
                  {col.title.charAt(0) + col.title.slice(1).toLowerCase()}
                </DropdownMenuItem>
              );
            })}
            
            <DropdownMenuSeparator className="my-1.5 bg-white/10" />
            
            {task.status !== 'DONE' ? (
              <DropdownMenuItem
                onClick={() => onComplete(task.id)}
                className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                style={{ color: '#10B981' }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Als erledigt markieren
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onReopen(task.id)}
                className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                style={{ color: '#FE9100' }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Wieder öffnen
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Priority Dot */}
        <div 
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: getPriorityColor() }}
        />
      </div>
      
      {/* Meta Row */}
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
        <span>Fällig: {formatDueDate()}</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// COLUMN COMPONENT (No Drag & Drop - Popover for Info)
// ============================================================================

interface ColumnProps {
  column: Column;
  tasks: InternalTask[];
  onTaskComplete: (taskId: string) => void;
  onTaskReopen: (taskId: string) => void;
  onTaskMove: (taskId: string, columnId: ColumnId) => void;
  onTaskClick: (task: InternalTask) => void;
  onAddTask: () => void;
}

function KanbanColumn({ column, tasks, onTaskComplete, onTaskReopen, onTaskMove, onTaskClick, onAddTask }: ColumnProps) {
  const Icon = column.icon;

  return (
    <div 
      className="flex flex-col min-w-[200px] h-full"
      style={{
        borderRadius: '16px',
        padding: '14px',
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: '#FE9100' }} />
          <h3 
            className="text-[11px] tracking-[0.18em]"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4', opacity: 0.92 }}
          >
            {column.title}
          </h3>
          <span 
            className="text-[10px] min-w-[22px] h-[18px] flex items-center justify-center rounded-full"
            style={{ 
              background: 'rgba(255,106,0,0.10)', 
              border: '1px solid rgba(255,106,0,0.18)',
              color: '#FE9100' 
            }}
          >
            {tasks.length}
          </span>
        </div>
        
        {/* Info Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1 rounded-md transition-colors outline-none"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="end"
            sideOffset={8}
            collisionPadding={12}
            avoidCollisions={true}
            className="w-[280px] p-3 border-0 z-[100]"
            style={{
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(14px)',
              borderRadius: '14px',
              border: '1px solid rgba(255,106,0,0.22)',
              boxShadow: '0 18px 60px rgba(0,0,0,0.75)',
            }}
          >
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {column.description}
            </p>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Tasks */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px] max-h-[400px] pr-1 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className="w-6 h-6 mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Keine Aufgaben
            </p>
            {column.id === 'inbox' && (
              <button
                onClick={onAddTask}
                className="flex items-center gap-1 h-8 px-3 rounded-[10px] text-[11px] transition-colors"
                style={{ 
                  background: 'rgba(255,106,0,0.1)',
                  border: '1px solid rgba(255,106,0,0.18)',
                  color: '#FE9100',
                }}
              >
                <Plus className="w-3 h-3" />
                <span>Aufgabe</span>
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentColumn={column.id}
                onComplete={onTaskComplete}
                onReopen={onTaskReopen}
                onMove={onTaskMove}
                onClick={onTaskClick}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TASK DETAILS DRAWER (Portal + Fixed - Premium)
// ============================================================================

interface TaskDetailsDrawerProps {
  task: InternalTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onUpdate: (taskId: string, data: Partial<InternalTask>) => void;
  onMove: (taskId: string, columnId: ColumnId) => void;
}

function TaskDetailsDrawer({ task, isOpen, onClose, onComplete, onReopen, onUpdate, onMove }: TaskDetailsDrawerProps) {
  const [notes, setNotes] = useState(task?.description || '');
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (task) {
      setNotes(task.description || '');
    }
  }, [task?.id, task?.description]);
  
  useEffect(() => {
    if (!task || notes === (task.description || '')) return;
    
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    notesTimeoutRef.current = setTimeout(() => {
      onUpdate(task.id, { description: notes });
    }, 600);
    
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [notes, task, onUpdate]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        drawerRef.current?.focus();
      }, 100);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      
      if (previousActiveElement.current && !isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return 'Eingang';
      case 'IN_PROGRESS': return 'In Bearbeitung';
      case 'DONE': return 'Erledigt';
      case 'CANCELLED': return 'Abgebrochen';
      default: return status;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' };
      case 'IN_PROGRESS': return { bg: 'rgba(234,179,8,0.15)', color: '#EAB308' };
      case 'DONE': return { bg: 'rgba(16,185,129,0.15)', color: '#10B981' };
      case 'CANCELLED': return { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' };
      default: return { bg: 'rgba(255,255,255,0.1)', color: 'white' };
    }
  };

  if (!task) return null;

  const statusStyle = getStatusColor(task.status);
  const currentColumn = getTaskColumn(task);

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998]"
            style={{ 
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
            }}
          />
          
          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed z-[9999] flex flex-col outline-none overflow-hidden"
            style={{
              top: '12px',
              right: '12px',
              width: 'min(560px, 92vw)',
              height: 'calc(100vh - 24px)',
              borderRadius: '22px',
              background: 'rgba(0,0,0,0.94)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,106,0,0.18)',
              boxShadow: '0 40px 140px rgba(0,0,0,0.9)',
            }}
          >
            {/* Header (fixed) - Premium Executive */}
            <div 
              className="flex-shrink-0 flex items-center justify-between"
              style={{ 
                padding: '20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)' 
              }}
            >
              <div className="flex-1 min-w-0">
                <h2 
                  className="text-[17px] font-semibold mb-1.5 truncate"
                  style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Inter, sans-serif' }}
                >
                  {task.title}
                </h2>
                <p 
                  className="text-[11px]" 
                  style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}
                >
                  Aufgabe · ID {task.id.slice(-8)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[10px] transition-colors"
                style={{ 
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)' 
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body (scroll) - Premium spacing */}
            <div 
              className="flex-1 overflow-y-auto space-y-5"
              style={{ padding: '20px' }}
            >
              {/* Status Section */}
              <div>
                <label 
                  className="text-[10px] uppercase tracking-[0.20em] mb-2 block"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.65)' }}
                >
                  STATUS
                </label>
                <div className="flex items-center gap-3">
                  <span 
                    className="h-8 px-4 flex items-center rounded-full text-[13px] font-medium"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                  
                  {/* Status Change Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-8 px-3 flex items-center gap-1 rounded-lg text-[12px] transition-colors"
                        style={{ 
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        Status ändern
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={6}
                      className="w-[220px] p-1.5 border-0"
                      style={{
                        borderRadius: '14px',
                        background: 'rgba(0,0,0,0.94)',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 70px rgba(0,0,0,0.8)',
                      }}
                    >
                      {COLUMNS.filter(col => col.id !== 'done').map((col) => {
                        const isActive = currentColumn === col.id;
                        const Icon = col.icon;
                        return (
                          <DropdownMenuItem
                            key={col.id}
                            onClick={() => onMove(task.id, col.id)}
                            className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer relative"
                            style={{ 
                              color: isActive ? '#e9d7c4' : 'rgba(255,255,255,0.85)',
                              background: isActive ? 'rgba(255,106,0,0.08)' : 'transparent',
                            }}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-[#ff6a00]" />
                            )}
                            <Icon className="w-4 h-4 mr-2" style={{ color: isActive ? '#FE9100' : 'rgba(255,255,255,0.5)' }} />
                            {col.title.charAt(0) + col.title.slice(1).toLowerCase()}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator className="my-1.5 bg-white/10" />
                      {task.status !== 'DONE' ? (
                        <DropdownMenuItem
                          onClick={() => onComplete(task.id)}
                          className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                          style={{ color: '#10B981' }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Als erledigt markieren
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onReopen(task.id)}
                          className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                          style={{ color: '#FE9100' }}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Wieder öffnen
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Due Date Section */}
              <div>
                <label 
                  className="text-[10px] uppercase tracking-[0.20em] mb-2 block"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.65)' }}
                >
                  FÄLLIGKEIT
                </label>
                <div className="flex items-center gap-3">
                  <div 
                    className="flex items-center gap-2 h-10 px-3 rounded-lg flex-1"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: '#FE9100' }} />
                    <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {task.dueDate ? format(new Date(task.dueDate), 'EEEE, dd. MMMM yyyy', { locale: de }) : 'Kein Termin festgelegt'}
                    </span>
                  </div>
                  
                  {/* Quick Date Presets */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-10 px-3 flex items-center gap-1 rounded-lg text-[12px] transition-colors"
                        style={{ 
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        Ändern
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={6}
                      className="w-[180px] p-1.5 border-0"
                      style={{
                        borderRadius: '14px',
                        background: 'rgba(0,0,0,0.94)',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 70px rgba(0,0,0,0.8)',
                      }}
                    >
                      <DropdownMenuItem
                        onClick={() => onUpdate(task.id, { dueDate: endOfDay(new Date()).toISOString() })}
                        className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                      >
                        Heute
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onUpdate(task.id, { dueDate: endOfDay(addDays(new Date(), 1)).toISOString() })}
                        className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                      >
                        Morgen
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onUpdate(task.id, { dueDate: endOfDay(addDays(new Date(), 7)).toISOString() })}
                        className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                      >
                        In 7 Tagen
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1.5 bg-white/10" />
                      <DropdownMenuItem
                        onClick={() => onUpdate(task.id, { dueDate: null })}
                        className="h-[34px] rounded-[10px] px-3 text-[13px] cursor-pointer"
                        style={{ color: 'rgba(239,68,68,0.9)' }}
                      >
                        Entfernen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Notes Section */}
              <div>
                <label 
                  className="text-[10px] uppercase tracking-[0.20em] mb-2 block"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.65)' }}
                >
                  NOTIZEN
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notiz hinzufügen…"
                  className="w-full p-3 rounded-lg outline-none transition-colors text-[13px]"
                  style={{ 
                    minHeight: '140px',
                    resize: 'none',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,106,0,0.4)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'}
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Notizen werden automatisch gespeichert.
                </p>
              </div>
              
              {/* Activity Section */}
              <div>
                <label 
                  className="text-[10px] uppercase tracking-[0.20em] mb-2 block"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.65)' }}
                >
                  AKTIVITÄT
                </label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>Erstellt:</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {format(new Date(task.createdAt), 'dd.MM.yyyy, HH:mm', { locale: de })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>Zuletzt geändert:</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {format(new Date(task.updatedAt), 'dd.MM.yyyy, HH:mm', { locale: de })}
                    </span>
                  </div>
                  {task.assignedUserId && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>Zugewiesen an:</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{task.assignedUserId}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer (fixed bottom) - Premium */}
            <div 
              className="flex-shrink-0 flex items-center justify-end gap-3"
              style={{ 
                padding: '16px 20px',
                borderTop: '1px solid rgba(255,255,255,0.06)' 
              }}
            >
              <button
                onClick={onClose}
                className="h-10 px-4 rounded-xl text-[13px] transition-colors"
                style={{ 
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.7)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                Schließen
              </button>
              {task.status !== 'DONE' ? (
                <button
                  onClick={() => {
                    onComplete(task.id);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(255,106,0,0.25)',
                  }}
                >
                  <Check className="w-4 h-4" />
                  Erledigen
                </button>
              ) : (
                <button
                  onClick={() => {
                    onReopen(task.id);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(255,106,0,0.25)',
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Wieder öffnen
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
}

// ============================================================================
// QUICK ADD MODAL
// ============================================================================

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

function QuickAddModal({ isOpen, onClose, onCreate }: QuickAddModalProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTitle('');
    }
  }, [isOpen]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim());
      setTitle('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4"
          >
            <form 
              onSubmit={handleSubmit}
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(20,20,22,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              }}
            >
              <h3 
                className="text-[13px] tracking-[0.15em] mb-3"
                style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
              >
                NEUE AUFGABE
              </h3>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Was muss erledigt werden?"
                className="w-full px-3 py-2.5 rounded-lg outline-none text-[14px] mb-3"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,106,0,0.3)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg text-[13px]"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50"
                  style={{ 
                    background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                    color: 'white',
                  }}
                >
                  Erstellen
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// MAIN BOARD COMPONENT
// ============================================================================

interface MyTasksBoardProps {
  className?: string;
}

export function MyTasksBoard({ className = '' }: MyTasksBoardProps) {
  const [selectedTask, setSelectedTask] = useState<InternalTask | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks
  const { data: tasksData, isLoading, error } = useQuery({
    queryKey: ['internal-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/internal/tasks', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const tasks: InternalTask[] = tasksData || [];

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/internal/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-tasks'] });
      toast({ title: '✓ Aufgabe erstellt' });
    },
    onError: () => {
      toast({ title: 'Fehler beim Erstellen', variant: 'destructive' });
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InternalTask> }) => {
      const res = await fetch(`/api/internal/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-tasks'] });
    },
    onError: () => {
      toast({ title: 'Änderung konnte nicht gespeichert werden.', variant: 'destructive' });
    },
  });

  // Complete task
  const handleComplete = useCallback((taskId: string) => {
    updateMutation.mutate({ id: taskId, data: { status: 'DONE' } });
    toast({ title: '✓ Aufgabe erledigt' });
  }, [updateMutation, toast]);

  // Reopen task
  const handleReopen = useCallback((taskId: string) => {
    updateMutation.mutate({ id: taskId, data: { status: 'OPEN' } });
    toast({ title: 'Aufgabe wieder geöffnet' });
  }, [updateMutation, toast]);

  // Update task
  const handleUpdate = useCallback((taskId: string, data: Partial<InternalTask>) => {
    updateMutation.mutate({ id: taskId, data });
  }, [updateMutation]);

  // Handle move (status change via menu)
  const handleMove = useCallback((taskId: string, columnId: ColumnId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    let newData: Partial<InternalTask> = {};
    
    switch (columnId) {
      case 'inbox':
        newData = { status: 'OPEN', dueDate: null };
        break;
      case 'open':
        newData = { 
          status: 'OPEN',
          dueDate: task.dueDate || endOfDay(new Date()).toISOString(),
        };
        break;
      case 'done':
        newData = { status: 'DONE' };
        break;
    }
    
    updateMutation.mutate({ id: taskId, data: newData });
  }, [tasks, updateMutation]);

  // Open task details
  const handleTaskClick = useCallback((task: InternalTask) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  }, []);

  // Close drawer
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedTask(null), 200);
  }, []);

  // Organize tasks into columns
  const columnTasks = useMemo(() => {
    const organized: Record<ColumnId, InternalTask[]> = {
      inbox: [],
      open: [],
      done: [],
    };
    
    for (const task of tasks) {
      if (!showCompleted && (task.status === 'DONE' || task.status === 'CANCELLED')) {
        continue;
      }
      const column = getTaskColumn(task);
      organized[column].push(task);
    }
    
    // Sort each column
    for (const columnId of Object.keys(organized) as ColumnId[]) {
      organized[columnId].sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    return organized;
  }, [tasks, showCompleted]);

  return (
    <div 
      className={`max-w-[1200px] mx-auto ${className}`}
    >
      {/* Main Board - Full Width */}
      <div 
        style={{
          borderRadius: '20px',
          padding: '20px',
          background: 'rgba(0,0,0,0.42)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Board Header - Executive ruhig */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div>
              <h2 
                className="text-[13px]"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif', 
                  letterSpacing: '0.24em',
                  color: '#e9d7c4', 
                  opacity: 0.95 
                }}
              >
                MEINE AUFGABEN
              </h2>
              <p 
                className="text-[12px] mt-1.5" 
                style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}
              >
                Status ändern über Menü · Klick öffnet Details
              </p>
            </div>
            
            {/* ARAS HINWEIS Button with Portal Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="group relative h-[30px] px-3 flex items-center gap-2 overflow-hidden transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    minWidth: '118px',
                    borderRadius: '999px',
                    background: 'rgba(0,0,0,0.6)',
                    border: '2px solid transparent',
                    borderImage: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00) 1',
                    boxShadow: '0 0 12px rgba(254,145,0,0.45), 0 4px 12px rgba(0,0,0,0.3)',
                    // @ts-ignore
                    '--tw-ring-color': 'rgba(254,145,0,0.55)',
                    '--tw-ring-offset-color': 'transparent',
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 18px rgba(254,145,0,0.65), 0 6px 16px rgba(0,0,0,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(254,145,0,0.45), 0 4px 12px rgba(0,0,0,0.3)';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(1px)';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(254,145,0,0.35), 0 2px 8px rgba(0,0,0,0.3)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Pulse Dot */}
                  <span 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      background: '#FE9100',
                      boxShadow: '0 0 8px rgba(254,145,0,0.6)',
                      animation: 'hinweisPulse 1.5s ease-in-out infinite',
                    }}
                  />
                  {/* Gradient Text */}
                  <span
                    className="text-[12px] font-semibold tracking-[0.18em]"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(90deg, #e9d7c4 0%, #FE9100 50%, #a34e00 100%)',
                      backgroundSize: '200% 100%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'hinweisGradient 6s linear infinite',
                    }}
                  >
                    HINWEIS
                  </span>
                  {/* Info Icon */}
                  <Info className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />
                  {/* Shine Sweep Overlay */}
                  <span
                    className="absolute inset-0 pointer-events-none overflow-hidden"
                    style={{ borderRadius: '999px' }}
                  >
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                        transform: 'skewX(-25deg) translateX(-150%)',
                        animation: 'hinweisShine 0.8s ease-out forwards',
                        animationPlayState: 'paused',
                      }}
                    />
                  </span>
                  {/* CSS Keyframes injected via style tag */}
                  <style>{`
                    @keyframes hinweisPulse {
                      0%, 100% { transform: scale(1); opacity: 1; }
                      50% { transform: scale(1.35); opacity: 0.6; }
                    }
                    @keyframes hinweisGradient {
                      0% { background-position: 0% 50%; }
                      50% { background-position: 100% 50%; }
                      100% { background-position: 0% 50%; }
                    }
                    @keyframes hinweisShine {
                      0% { transform: skewX(-25deg) translateX(-150%); }
                      100% { transform: skewX(-25deg) translateX(250%); }
                    }
                    .group:hover span[style*="hinweisShine"] {
                      animation-play-state: running !important;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      @keyframes hinweisPulse { 0%, 100% { transform: scale(1); opacity: 1; } }
                      @keyframes hinweisGradient { 0%, 100% { background-position: 0% 50%; } }
                      @keyframes hinweisShine { 0%, 100% { transform: skewX(-25deg) translateX(-150%); } }
                    }
                  `}</style>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={10}
                collisionPadding={12}
                avoidCollisions={true}
                className="w-[380px] max-w-[calc(100vw-24px)] p-0 border-0 z-[100]"
                style={{
                  background: 'rgba(0,0,0,0.92)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(254,145,0,0.22)',
                  borderRadius: '18px',
                  boxShadow: '0 22px 80px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <div className="p-[14px] pb-[12px]">
                  {/* Header */}
                  <h4 
                    className="text-[11px] mb-2.5"
                    style={{ 
                      fontFamily: 'Orbitron, sans-serif', 
                      letterSpacing: '0.22em',
                      background: 'linear-gradient(90deg, #e9d7c4 0%, #FE9100 50%, #a34e00 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      opacity: 0.90,
                    }}
                  >
                    KURZANLEITUNG
                  </h4>
                  {/* Body */}
                  <p 
                    className="text-[13px] leading-[1.55]" 
                    style={{ 
                      fontFamily: 'Inter, sans-serif',
                      color: 'rgba(255,255,255,0.80)',
                    }}
                  >
                    Öffnen Sie Aufgaben per Klick. Den Status ändern Sie über das Menü (⋯) oben rechts. Neue Aufgaben erstellen Sie mit dem + Button.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter Ghost Button */}
            <button
              className="h-9 px-3.5 flex items-center gap-2 text-[12px] transition-all duration-150"
              style={{ 
                borderRadius: '10px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
              }}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            
            {/* + Aufgabe Primary Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-9 px-4 flex items-center gap-2 text-[12px] font-medium transition-all duration-150"
              style={{ 
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff6a00 0%, #b55400 100%)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(255,106,0,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,106,0,0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,106,0,0.25)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
                <Plus className="w-4 h-4" />
                Aufgabe
              </button>
            </div>
          </div>
          
          {/* Subtle Separator */}
          <div 
            className="h-px mb-5 relative overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div 
              className="absolute left-0 top-0 h-full w-24"
              style={{ 
                background: 'linear-gradient(90deg, rgba(255,106,0,0.3), transparent)',
              }}
            />
          </div>
          
          {/* Board Columns */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#FE9100' }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Aufgaben konnten nicht geladen werden.
              </p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['internal-tasks'] })}
                className="text-[12px]"
                style={{ color: '#FE9100' }}
              >
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 overflow-x-auto pb-2">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks[column.id]}
                  onTaskComplete={handleComplete}
                  onTaskReopen={handleReopen}
                  onTaskMove={handleMove}
                  onTaskClick={handleTaskClick}
                  onAddTask={() => setIsAddModalOpen(true)}
                />
              ))}
            </div>
          )}
        </div>
      
      {/* Task Details Drawer */}
      <TaskDetailsDrawer
        task={selectedTask}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onComplete={handleComplete}
        onReopen={handleReopen}
        onUpdate={handleUpdate}
        onMove={handleMove}
      />
      
      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreate={(title) => createMutation.mutate(title)}
      />
    </div>
  );
}

export default MyTasksBoard;
