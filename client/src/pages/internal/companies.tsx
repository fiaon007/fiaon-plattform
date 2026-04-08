/**
 * ============================================================================
 * ARAS COMMAND CENTER - COMPANIES
 * ============================================================================
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Plus, Globe, Building2, Tag, AlertCircle, RefreshCw, Pencil, Trash2, X } from "lucide-react";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useArasDebug, useArasDebugMount } from "@/hooks/useArasDebug";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

export default function InternalCompanies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", website: "", industry: "" });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useArasDebugMount('InternalCompanies', '/internal/companies');

  const { data: companies, isLoading, error, status, refetch } = useQuery({
    queryKey: ['/api/internal/companies', searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/internal/companies?search=${encodeURIComponent(searchQuery)}`
        : '/api/internal/companies';
      const result = await apiGet<Company[]>(url);
      if (!result.ok) throw result.error;
      return result.data || [];
    }
  });

  useArasDebug({
    route: '/internal/companies',
    queryKey: ['/api/internal/companies', searchQuery],
    status: status as any,
    data: companies,
    error,
    componentName: 'InternalCompanies'
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      const result = await apiPost('/api/internal/companies', data);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to create company');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/companies'] });
      setIsCreateOpen(false);
      setNewCompany({ name: "", website: "", industry: "" });
      toast({ title: "Company created", description: "New company added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!newCompany.name.trim()) {
      toast({ title: "Error", description: "Company name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(newCompany);
  };

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; website?: string; industry?: string }) => {
      const result = await apiPatch(`/api/internal/companies/${data.id}`, { name: data.name, website: data.website, industry: data.industry });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to update company');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/companies'] });
      setEditingCompany(null);
      toast({ title: "Company updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiDelete(`/api/internal/companies/${id}`);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to delete company');
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/companies'] });
      setDeleteConfirm(null);
      toast({ title: "Company deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Company
          </Button>
        </div>

        {/* Create Form */}
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-white/5 border-orange-500/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">Create New Company</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Company Name *"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Website"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Industry"
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Company'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
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
                <span>Error loading companies: {(error as Error).message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            // Loading Skeleton
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : !companies || companies.length === 0 ? (
            // Empty State
            <div className="col-span-full">
              <Card className="bg-white/5 border-white/10 border-dashed">
                <CardContent className="p-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Companies Yet</h3>
                  <p className="text-gray-400 mb-4">Start by adding your first company</p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Company
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            companies.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all group rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate group-hover:text-orange-400 transition-colors">
                          {company.name}
                        </h3>
                        {company.industry && (
                          <p className="text-sm text-gray-400 truncate">{company.industry}</p>
                        )}
                        <div className="mt-3 space-y-1">
                          {company.website && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Globe className="w-3 h-3" />
                              <span className="truncate">{company.website}</span>
                            </div>
                          )}
                          {company.tags && company.tags.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Tag className="w-3 h-3" />
                              <span className="truncate">{company.tags.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setEditingCompany(company); }}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4 text-gray-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(company.id); }}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

        {/* Edit Modal */}
        {editingCompany && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Edit Company</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditingCompany(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <Input
                  placeholder="Company Name"
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  placeholder="Website"
                  value={editingCompany.website || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, website: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  placeholder="Industry"
                  value={editingCompany.industry || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, industry: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => editMutation.mutate({
                      id: editingCompany.id,
                      name: editingCompany.name,
                      website: editingCompany.website,
                      industry: editingCompany.industry
                    })}
                    disabled={editMutation.isPending}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingCompany(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm mx-4"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Delete Company?</h3>
                <p className="text-gray-400 text-sm mb-6">
                  This action cannot be undone. All related data will be permanently removed.
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
