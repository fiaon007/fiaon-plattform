/**
 * ============================================================================
 * ARAS COMMAND CENTER - CONTACTS
 * ============================================================================
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Plus, Mail, Phone, Building2, AlertCircle, RefreshCw, Users, Sparkles, X } from "lucide-react";
import { AIInsightCard, AIInsightData } from "@/components/internal/ai-insight-card";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useArasDebug, useArasDebugMount } from "@/hooks/useArasDebug";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { AStatePanel } from "@/components/ui/aras-primitives";
import { useLocation } from "wouter";
import { useHighlightEntity } from "@/hooks/useHighlightEntity";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  companyId?: string;
  source?: string;
  status: "NEW" | "ACTIVE" | "ARCHIVED";
  tags?: string[];
  notes?: string;
}

export default function InternalContacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: "", lastName: "", email: "", phone: "", position: "" });
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [aiSummary, setAiSummary] = useState<AIInsightData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const showDebug = typeof window !== 'undefined' && localStorage.getItem('aras_debug') === '1';
  const { isHighlighted, getHighlightClass, registerRef } = useHighlightEntity();

  // Dev-only debug mount tracking
  useArasDebugMount('InternalContacts', '/internal/contacts');

  const { data: contacts, isLoading, error, status, refetch } = useQuery({
    queryKey: ['/api/internal/contacts', searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/internal/contacts?search=${encodeURIComponent(searchQuery)}`
        : '/api/internal/contacts';
      const result = await apiGet<Contact[]>(url);
      if (!result.ok) throw result.error;
      return result.data || [];
    }
  });

  // Dev-only debug logging
  useArasDebug({
    route: '/internal/contacts',
    queryKey: ['/api/internal/contacts', searchQuery],
    status: status as any,
    data: contacts,
    error,
    componentName: 'InternalContacts'
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newContact) => {
      const result = await apiPost('/api/internal/contacts', data);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to create contact');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/contacts'] });
      setIsCreateOpen(false);
      setNewContact({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact created", description: "New contact added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) {
      toast({ title: "Error", description: "First and last name are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(newContact);
  };

  const fetchAISummary = async (contactId: string) => {
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const result = await apiPost<{summary: AIInsightData}>('/api/internal/ai/contact-summary', { contactId });
      if (!result.ok) throw new Error(result.error?.message || 'Failed to fetch summary');
      setAiSummary(result.data?.summary || null);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Suche nach Name, E-Mail, Telefon..."
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
            Neuer Kontakt
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
                <h3 className="text-lg font-semibold text-white">Create New Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="First Name *"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Last Name *"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Position"
                    value={newContact.position}
                    onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Contact'}
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
                <span>Error loading contacts: {(error as Error).message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            // Loading Skeleton
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full" />
                    <div className="flex-1">
                      <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
                      <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : !contacts || contacts.length === 0 ? (
            // Empty State
            <div className="col-span-full">
              <Card className="bg-white/5 border-white/10 border-dashed">
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Contacts Yet</h3>
                  <p className="text-gray-400 mb-4">Start by adding your first contact</p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            contacts?.map((contact: any, index: number) => (
              <motion.div
                key={contact.id}
                ref={(el) => registerRef(contact.id, el)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={`bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer rounded-2xl group ${getHighlightClass(contact.id)}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">
                          {contact.firstName} {contact.lastName}
                        </h3>
                        {contact.position && (
                          <p className="text-sm text-gray-400 truncate">{contact.position}</p>
                        )}
                        <div className="mt-3 space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Phone className="w-3 h-3" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                          {contact.companyId && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Building2 className="w-3 h-3" />
                              <span>Company ID: {contact.companyId.slice(0, 8)}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contact.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                            contact.status === 'NEW' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {contact.status}
                          </span>
                          {contact.source && (
                            <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400">
                              {contact.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

        {/* Contact Detail Drawer */}
        {selectedContact && (
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
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl">
                      {selectedContact.firstName?.charAt(0)}{selectedContact.lastName?.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </h2>
                      {selectedContact.position && (
                        <p className="text-gray-400">{selectedContact.position}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedContact(null);
                      setAiSummary(null);
                      setAiError(null);
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  {selectedContact.email && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <a href={`mailto:${selectedContact.email}`} className="hover:text-orange-400">
                        {selectedContact.email}
                      </a>
                    </div>
                  )}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <a href={`tel:${selectedContact.phone}`} className="hover:text-orange-400">
                        {selectedContact.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedContact.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                    selectedContact.status === 'NEW' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {selectedContact.status}
                  </span>
                  {selectedContact.source && (
                    <span className="px-3 py-1 rounded-full text-sm bg-orange-500/20 text-orange-400">
                      {selectedContact.source}
                    </span>
                  )}
                </div>

                {/* AI Summary Section */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-orange-400" />
                      ARAS AI Summary
                    </h3>
                    {!aiSummary && !aiLoading && (
                      <Button
                        size="sm"
                        onClick={() => fetchAISummary(selectedContact.id)}
                        className="bg-gradient-to-r from-orange-500 to-orange-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Analyze
                      </Button>
                    )}
                  </div>
                  
                  <AIInsightCard
                    data={aiSummary}
                    isLoading={aiLoading}
                    error={aiError}
                    onRetry={() => fetchAISummary(selectedContact.id)}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
    </InternalLayout>
  );
}
