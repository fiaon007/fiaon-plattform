/**
 * ============================================================================
 * ARAS COMMAND CENTER - TASKS
 * ============================================================================
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, CheckSquare, AlertCircle, RefreshCw, Clock, Check, X } from "lucide-react";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useArasDebug, useArasDebugMount } from "@/hooks/useArasDebug";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useHighlightEntity } from "@/hooks/useHighlightEntity";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  assignedUserId?: string;
  relatedContactId?: string;
  relatedDealId?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  OPEN: { label: 'Open', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  DONE: { label: 'Done', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
};

export default function InternalTasks() {
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getHighlightClass, registerRef } = useHighlightEntity();

  useArasDebugMount('InternalTasks', '/internal/tasks');

  const { data: tasks, isLoading, error, status, refetch } = useQuery({
    queryKey: ['/api/internal/tasks', filter],
    queryFn: async () => {
      const url = filter === 'ALL' 
        ? '/api/internal/tasks'
        : `/api/internal/tasks?status=${filter}`;
      const result = await apiGet<Task[]>(url);
      if (!result.ok) throw result.error;
      return result.data || [];
    }
  });

  useArasDebug({
    route: '/internal/tasks',
    queryKey: ['/api/internal/tasks', filter],
    status: status as any,
    data: tasks,
    error,
    componentName: 'InternalTasks'
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const result = await apiPost('/api/internal/tasks', {
          ...data,
          dueDate: data.dueDate || undefined
        });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to create task');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/tasks'] });
      setIsCreateOpen(false);
      setNewTask({ title: "", description: "", dueDate: "" });
      toast({ title: "Task created", description: "New task added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const result = await apiPatch(`/api/internal/tasks/${id}`, { status });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to update task');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/tasks'] });
      toast({ title: "Task updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!newTask.title.trim()) {
      toast({ title: "Error", description: "Task title is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(newTask);
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const isOverdue = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const filteredTasks = tasks?.filter(t => filter === 'ALL' || t.status === filter) || [];

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-6 h-6 text-orange-400" />
              Tasks
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {filteredTasks.filter(t => t.status === 'OPEN').length} open • {filteredTasks.filter(t => t.status === 'DONE').length} done
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map(s => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(s)}
              className={filter === s ? 'bg-orange-500' : ''}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
            </Button>
          ))}
        </div>

        {/* Create Form */}
        {isCreateOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="bg-white/5 border-orange-500/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">Create New Task</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Task Title *"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Error loading tasks: {(error as Error).message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tasks List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-6 h-6 bg-white/10 rounded" />
                  <div className="flex-1">
                    <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/4" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredTasks.length === 0 ? (
            <Card className="bg-white/5 border-white/10 border-dashed">
              <CardContent className="p-12 text-center">
                <CheckSquare className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Tasks</h3>
                <p className="text-gray-400 mb-4">
                  {filter === 'ALL' ? 'Create your first task' : `No ${STATUS_CONFIG[filter as TaskStatus]?.label.toLowerCase()} tasks`}
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />Add Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task, idx) => {
              const statusConfig = STATUS_CONFIG[task.status];
              const overdue = task.status !== 'DONE' && isOverdue(task.dueDate);
              
              return (
                <motion.div
                  key={task.id}
                  ref={(el) => registerRef(task.id, el)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className={`bg-white/5 border-white/10 hover:bg-white/10 transition-all ${overdue ? 'border-red-500/30' : ''} ${getHighlightClass(task.id)}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {/* Status Toggle */}
                      <button
                        onClick={() => updateStatusMutation.mutate({ 
                          id: task.id, 
                          status: task.status === 'DONE' ? 'OPEN' : 'DONE' 
                        })}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                          ${task.status === 'DONE' 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-500 hover:border-green-500'
                          }`}
                      >
                        {task.status === 'DONE' && <Check className="w-4 h-4 text-white" />}
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium truncate ${task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-gray-400 truncate">{task.description}</p>
                        )}
                      </div>

                      {/* Due Date */}
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </div>
                      )}

                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>

                      {/* Cancel Button */}
                      {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: task.id, status: 'CANCELLED' })}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </Button>
                      )}
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
