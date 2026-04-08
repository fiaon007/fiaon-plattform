/**
 * ============================================================================
 * ARAS COMMAND CENTER - DEALS PIPELINE
 * ============================================================================
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, TrendingUp, AlertCircle, RefreshCw, ChevronRight, DollarSign, Sparkles, X, Trash2 } from "lucide-react";
import { AIInsightCard, AIInsightData } from "@/components/internal/ai-insight-card";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useArasDebug, useArasDebugMount } from "@/hooks/useArasDebug";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type DealStage = "IDEA" | "CONTACTED" | "NEGOTIATION" | "COMMITTED" | "CLOSED_WON" | "CLOSED_LOST";

interface Deal {
  id: string;
  title: string;
  value?: number;
  currency: string;
  stage: DealStage;
  contactId?: string;
  companyId?: string;
  probability?: number;
  closeDate?: string;
  notes?: string;
  createdAt: string;
}

const STAGES: { key: DealStage; label: string; color: string; bgColor: string }[] = [
  { key: 'IDEA', label: 'Idea', color: 'text-gray-400', bgColor: 'bg-gray-600' },
  { key: 'CONTACTED', label: 'Contacted', color: 'text-blue-400', bgColor: 'bg-blue-600' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'text-yellow-400', bgColor: 'bg-yellow-600' },
  { key: 'COMMITTED', label: 'Committed', color: 'text-green-400', bgColor: 'bg-green-600' },
  { key: 'CLOSED_WON', label: 'Won', color: 'text-emerald-400', bgColor: 'bg-emerald-600' },
  { key: 'CLOSED_LOST', label: 'Lost', color: 'text-red-400', bgColor: 'bg-red-600' },
];

export default function InternalDeals() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: "", value: "", stage: "IDEA" as DealStage });
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [aiNextSteps, setAiNextSteps] = useState<AIInsightData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useArasDebugMount('InternalDeals', '/internal/deals');

  const { data: deals, isLoading, error, status, refetch } = useQuery({
    queryKey: ['/api/internal/deals'],
    queryFn: async () => {
      const result = await apiGet<Deal[]>('/api/internal/deals');
      if (!result.ok) throw result.error;
      return result.data || [];
    }
  });

  useArasDebug({
    route: '/internal/deals',
    queryKey: '/api/internal/deals',
    status: status as any,
    data: deals,
    error,
    componentName: 'InternalDeals'
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; value?: number; stage: DealStage }) => {
      const result = await apiPost('/api/internal/deals', data);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to create deal');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/deals'] });
      setIsCreateOpen(false);
      setNewDeal({ title: "", value: "", stage: "IDEA" });
      toast({ title: "Deal created", description: "New deal added to pipeline" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: DealStage }) => {
      const result = await apiPatch(`/api/internal/deals/${id}`, { stage });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to update deal');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/deals'] });
      toast({ title: "Stage updated", description: "Deal moved to new stage" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!newDeal.title.trim()) {
      toast({ title: "Error", description: "Deal title is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: newDeal.title,
      value: newDeal.value ? parseInt(newDeal.value) * 100 : undefined,
      stage: newDeal.stage
    });
  };

  const getDealsForStage = (stage: DealStage): Deal[] => {
    return deals?.filter(d => d.stage === stage) || [];
  };

  const formatCurrency = (cents?: number): string => {
    if (!cents) return '–';
    return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const getNextStage = (current: DealStage): DealStage | null => {
    const currentIndex = STAGES.findIndex(s => s.key === current);
    if (currentIndex < STAGES.length - 2) { // -2 to skip CLOSED_LOST
      return STAGES[currentIndex + 1].key;
    }
    return null;
  };

  const fetchAINextSteps = async (dealId: string) => {
    setAiLoading(true);
    setAiError(null);
    setAiNextSteps(null);
    try {
      const result = await apiPost<{steps: any}>('/api/internal/ai/deal-next-steps', { dealId });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to fetch AI steps');
      setAiNextSteps(result.data?.steps);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiDelete(`/api/internal/deals/${id}`);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to delete deal');
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/deals'] });
      setDeleteConfirm(null);
      setSelectedDeal(null);
      toast({ title: "Deal deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-orange-400" />
              Sales Pipeline
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {deals?.length || 0} deals • {formatCurrency(deals?.reduce((sum, d) => sum + (d.value || 0), 0))} total value
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Button>
        </div>

        {/* Create Form */}
        {isCreateOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="bg-white/5 border-orange-500/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">Create New Deal</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Deal Title *"
                    value={newDeal.title}
                    onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Value (EUR)"
                    type="number"
                    value={newDeal.value}
                    onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <select
                    value={newDeal.stage}
                    onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value as DealStage })}
                    className="bg-white/5 border border-white/10 text-white rounded-md px-3 py-2"
                  >
                    {STAGES.slice(0, -2).map(s => (
                      <option key={s.key} value={s.key} className="bg-gray-900">{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Deal'}
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
                <span>Error loading deals: {(error as Error).message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Kanban */}
        {isLoading ? (
          <div className="grid grid-cols-6 gap-4">
            {STAGES.map(stage => (
              <div key={stage.key} className="space-y-3">
                <div className={`${stage.bgColor} text-white px-3 py-2 rounded-lg text-center text-sm font-medium`}>
                  {stage.label}
                </div>
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                      <CardContent className="p-3">
                        <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-4">
            {STAGES.map(stage => {
              const stageDeals = getDealsForStage(stage.key);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              
              return (
                <div key={stage.key} className="space-y-3">
                  {/* Stage Header */}
                  <div className={`${stage.bgColor} text-white px-3 py-2 rounded-lg`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-xs opacity-80">{stageDeals.length}</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">{formatCurrency(stageValue)}</div>
                  </div>
                  
                  {/* Deals */}
                  <div className="space-y-2 min-h-[200px]">
                    {stageDeals.length === 0 ? (
                      <div className="text-center text-gray-500 text-xs py-8 border border-dashed border-white/10 rounded-lg">
                        No deals
                      </div>
                    ) : (
                      stageDeals.map((deal, idx) => {
                        const nextStage = getNextStage(deal.stage);
                        return (
                          <motion.div
                            key={deal.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card 
                                            className="bg-white/5 border-white/10 hover:bg-white/10 transition-all group rounded-xl cursor-pointer"
                                            onClick={() => setSelectedDeal(deal)}
                                          >
                              <CardContent className="p-3">
                                <h4 className="text-sm font-medium text-white truncate mb-1">{deal.title}</h4>
                                {deal.value && (
                                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                                    <DollarSign className="w-3 h-3" />
                                    {formatCurrency(deal.value)}
                                  </div>
                                )}
                                {nextStage && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => updateStageMutation.mutate({ id: deal.id, stage: nextStage })}
                                    disabled={updateStageMutation.isPending}
                                  >
                                    Move to {STAGES.find(s => s.key === nextStage)?.label}
                                    <ChevronRight className="w-3 h-3 ml-1" />
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
              );
            })}
          </div>
        )}
      </div>

        {/* Deal Detail Drawer */}
        {selectedDeal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="bg-gray-900 border-l border-white/10 h-full w-full max-w-lg overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedDeal.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STAGES.find(s => s.key === selectedDeal.stage)?.bgColor}`}>
                        {STAGES.find(s => s.key === selectedDeal.stage)?.label}
                      </span>
                      {selectedDeal.value && (
                        <span className="text-gray-400 text-sm">{formatCurrency(selectedDeal.value)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDeal(null);
                      setAiNextSteps(null);
                      setAiError(null);
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Deal Info */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedDeal.probability !== undefined && (
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Probability</span>
                      <p className="text-white font-medium">{selectedDeal.probability}%</p>
                    </div>
                  )}
                  {selectedDeal.closeDate && (
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Close Date</span>
                      <p className="text-white font-medium">
                        {new Date(selectedDeal.closeDate).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Stage Actions */}
                <div className="space-y-2">
                  <span className="text-gray-500 text-xs uppercase">Move to Stage</span>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.filter(s => s.key !== selectedDeal.stage).map(stage => (
                      <Button
                        key={stage.key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateStageMutation.mutate({ id: selectedDeal.id, stage: stage.key });
                          setSelectedDeal({ ...selectedDeal, stage: stage.key });
                        }}
                        className={`text-xs ${stage.color}`}
                      >
                        {stage.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedDeal.notes && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase">Notes</span>
                    <p className="text-gray-300 mt-1">{selectedDeal.notes}</p>
                  </div>
                )}

                {/* AI Next Steps Section */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-orange-400" />
                      ARAS AI Next Steps
                    </h3>
                    {!aiNextSteps && !aiLoading && (
                      <Button
                        size="sm"
                        onClick={() => fetchAINextSteps(selectedDeal.id)}
                        className="bg-gradient-to-r from-orange-500 to-orange-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Suggest
                      </Button>
                    )}
                  </div>
                  
                  <AIInsightCard
                    data={aiNextSteps}
                    isLoading={aiLoading}
                    error={aiError}
                    onRetry={() => fetchAINextSteps(selectedDeal.id)}
                  />
                </div>

                {/* Delete Button */}
                <div className="pt-4 border-t border-white/10">
                  <Button
                    variant="outline"
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleteConfirm(selectedDeal.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Deal
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm mx-4"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Delete Deal?</h3>
                <p className="text-gray-400 text-sm mb-6">
                  This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate(deleteConfirm)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
    </InternalLayout>
  );
}
