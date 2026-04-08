import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Contact, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  User as UserIcon, 
  StickyNote,
  Pencil,
  Trash2,
  Save,
  X,
  Upload,
  Download
} from 'lucide-react';
import type { User, SubscriptionResponse } from "@shared/schema";

// ARAS CI
const CI = {
  goldLight: '#E9D7C4',
  orange: '#FE9100',
  goldDark: '#A34E00',
  black: '#0a0a0a'
};

interface ContactData {
  id?: string;
  company: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function Contacts() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadTooltip, setShowUploadTooltip] = useState(false);
  const [showTemplateTooltip, setShowTemplateTooltip] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Form State
  const [formData, setFormData] = useState<ContactData>({
    company: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: ''
  });

  // Fetch subscription
  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  const handleSectionChange = (section: string) => {
    window.location.href = `/app/${section}`;
  };

  // Fetch contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<ContactData[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });

  // Create/Update contact mutation
  const saveMutation = useMutation({
    mutationFn: async (contact: ContactData) => {
      const url = contact.id ? `/api/contacts/${contact.id}` : '/api/contacts';
      const method = contact.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contact)
      });
      if (!res.ok) {
        console.error('[Contacts] Failed to save contact');
        return null;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      resetForm();
      toast({
        title: editingContact ? 'Gespeichert' : 'Hinzugefügt',
        description: 'Kontakt wurde erfolgreich gespeichert.'
      });
    },
    onError: () => {
      toast({
        title: 'Fehler',
        description: 'Kontakt konnte nicht gespeichert werden.',
        variant: 'destructive'
      });
    }
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (contacts: ContactData[]) => {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contacts })
      });
      if (!res.ok) {
        console.error('[Contacts] Failed to import contacts');
        return null;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: 'Import erfolgreich',
        description: `${data.imported} Kontakte importiert.`
      });
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Import fehlgeschlagen',
        description: error.message || 'CSV konnte nicht importiert werden.',
        variant: 'destructive'
      });
      setIsUploading(false);
    }
  });

  // Delete contact mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        console.error('[Contacts] Failed to delete contact');
        return null;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: 'Gelöscht',
        description: 'Kontakt wurde entfernt.'
      });
    },
    onError: () => {
      toast({
        title: 'Fehler',
        description: 'Kontakt konnte nicht gelöscht werden.',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      company: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      notes: ''
    });
    setEditingContact(null);
    setShowAddForm(false);
  };

  const handleEdit = (contact: ContactData) => {
    setEditingContact(contact);
    setFormData(contact);
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!formData.company.trim()) {
      toast({
        title: 'Firma erforderlich',
        description: 'Bitte Firmennamen eingeben.',
        variant: 'destructive'
      });
      return;
    }

    saveMutation.mutate(editingContact ? { ...formData, id: editingContact.id } : formData);
  };

  const handleDelete = (id: string) => {
    if (confirm('Kontakt löschen?')) {
      deleteMutation.mutate(id);
    }
  };

  // CSV Upload Handler
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Ungültiges Format',
        description: 'Bitte eine CSV-Datei hochladen.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: 'Fehler',
            description: 'CSV muss mindestens Header und eine Zeile enthalten',
            variant: 'destructive'
          });
          return;
        }

        // Parse Header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Parse Rows
        const contacts: ContactData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          
          const contact: ContactData = {
            company: '',
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            notes: ''
          };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            if (header.includes('firma') || header.includes('company') || header.includes('unternehmen')) {
              contact.company = value;
            } else if (header.includes('vorname') || header.includes('firstname') || header.includes('first')) {
              contact.firstName = value;
            } else if (header.includes('nachname') || header.includes('lastname') || header.includes('last')) {
              contact.lastName = value;
            } else if (header.includes('telefon') || header.includes('phone') || header.includes('tel')) {
              contact.phone = value;
            } else if (header.includes('email') || header.includes('mail') || header.includes('e-mail')) {
              contact.email = value;
            } else if (header.includes('notiz') || header.includes('note') || header.includes('bemerkung')) {
              contact.notes = value;
            }
          });

          // Only add if company is present
          if (contact.company.trim()) {
            contacts.push(contact);
          }
        }

        if (contacts.length === 0) {
          toast({
            title: 'Fehler',
            description: 'Keine gültigen Kontakte in der CSV gefunden. Firma ist ein Pflichtfeld. Bitte verwenden Sie die Vorlage.',
            variant: 'destructive'
          });
          return;
        }

        // Import
        bulkImportMutation.mutate(contacts);
        
        // Reset file input
        if (event.target) {
          event.target.value = '';
        }

      } catch (error: any) {
        console.error('[CSV Upload] Parse error:', error);
        toast({
          title: 'CSV Fehler',
          description: error.message || 'Fehler beim Parsen der CSV-Datei.',
          variant: 'destructive'
        });
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      toast({
        title: 'Fehler',
        description: 'Datei konnte nicht gelesen werden.',
        variant: 'destructive'
      });
      setIsUploading(false);
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Download CSV Template
  const downloadCSVTemplate = () => {
    const template = 'Firma,Vorname,Nachname,Telefon,Email,Notizen\nBeispiel GmbH,Max,Mustermann,+49123456789,max@beispiel.de,Wichtiger Kunde';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kontakte-vorlage.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" 
          style={{ borderColor: CI.orange, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen relative overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
      <Sidebar
        activeSection="contacts"
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopBar
          currentSection="contacts"
          subscriptionData={subscriptionData}
          user={user as User}
          isVisible={true}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.3))' }}>
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'Orbitron, sans-serif', background: 'linear-gradient(135deg, #FE9100 0%, #ff6b00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>KONTAKTE</h1>
              <p className="text-xs text-gray-400">{contacts.length} gespeichert</p>
            </div>

            {/* Info Banner - Top */}
            <AnimatePresence>
              {showInfoPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6"
                >
                  <div className="backdrop-blur-sm bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-[#FE9100]/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-[#FE9100]/20 flex items-center justify-center flex-shrink-0">
                          <StickyNote className="w-4 h-4 text-[#FE9100]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xs font-bold text-[#FE9100] uppercase tracking-wide mb-2">CSV Format Info</h3>
                          <p className="text-xs text-gray-300 leading-relaxed">
                            CSV Format beachten! Verwenden Sie die Vorlage für das korrekte Format. Firma ist ein Pflichtfeld.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={downloadCSVTemplate}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 hover:scale-105 whitespace-nowrap"
                          style={{
                            background: 'linear-gradient(135deg, #FE9100 0%, #ff6b00 100%)',
                            color: 'black'
                          }}
                        >
                          <Download className="w-3 h-3" />
                          Vorlage
                        </button>
                        <button
                          onClick={() => setShowInfoPanel(false)}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buttons Row */}
            <div className="flex gap-3 mb-8 justify-end">
                {/* CSV Upload - HIGH END */}
                <motion.div 
                  className="relative"
                  onMouseEnter={() => setShowUploadTooltip(true)}
                  onMouseLeave={() => setShowUploadTooltip(false)}
                  whileHover={{ scale: 1.02 }}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    id="csv-upload"
                  />
                  <motion.button
                    disabled={isUploading}
                    className="group px-4 py-2 text-xs font-medium bg-white/8 hover:bg-white/12 text-white rounded-lg transition-all border border-white/20 disabled:opacity-50 relative overflow-hidden"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Shimmer Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{
                        x: ['-100%', '200%']
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    />
                    <div className="relative flex items-center gap-2">
                      <motion.div
                        animate={{
                          y: isUploading ? [0, -3, 0] : 0
                        }}
                        transition={{
                          duration: 0.6,
                          repeat: isUploading ? Infinity : 0
                        }}
                      >
                        <Upload className="w-4 h-4" />
                      </motion.div>
                      <span className="font-semibold">
                        {isUploading ? 'Importiere...' : 'CSV hochladen'}
                      </span>
                    </div>
                  </motion.button>

                  {/* Animated Tooltip */}
                  <AnimatePresence>
                    {showUploadTooltip && !isUploading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="absolute top-full mt-2 left-0 z-50 w-64"
                      >
                        <div 
                          className="px-3 py-2 rounded-lg shadow-xl border"
                          style={{
                            background: 'rgba(0, 0, 0, 0.95)',
                            borderColor: `${CI.orange}40`,
                            backdropFilter: 'blur(20px)'
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="p-1 rounded"
                              style={{ background: `${CI.orange}20` }}
                            >
                              <Upload className="w-3 h-3" style={{ color: CI.orange }} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white mb-0.5">CSV Datei hochladen</p>
                              <p className="text-[10px] text-gray-400">Laden Sie hier Ihre Kontaktliste als CSV-Datei hoch. Bis zu 1000 Kontakte gleichzeitig.</p>
                            </div>
                          </div>
                          {/* Arrow */}
                          <div 
                            className="absolute -top-1 left-4 w-2 h-2 rotate-45"
                            style={{
                              background: `${CI.orange}40`,
                              borderLeft: `1px solid ${CI.orange}40`,
                              borderTop: `1px solid ${CI.orange}40`
                            }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Download Template - HIGH END */}
                <motion.div
                  className="relative"
                  onMouseEnter={() => setShowTemplateTooltip(true)}
                  onMouseLeave={() => setShowTemplateTooltip(false)}
                  whileHover={{ scale: 1.02 }}
                >
                  <motion.button
                    onClick={downloadCSVTemplate}
                    className="group px-4 py-2 text-xs font-medium bg-white/8 hover:bg-white/12 text-white rounded-lg transition-all border border-white/20 relative overflow-hidden"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Shimmer Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{
                        x: ['-100%', '200%']
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 4,
                        delay: 1
                      }}
                    />
                    <div className="relative flex items-center gap-2">
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Download className="w-4 h-4" />
                      </motion.div>
                      <span className="font-semibold">Vorlage</span>
                    </div>
                  </motion.button>

                  {/* Animated Tooltip */}
                  <AnimatePresence>
                    {showTemplateTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="absolute top-full mt-2 left-0 z-50 w-64"
                      >
                        <div 
                          className="px-3 py-2 rounded-lg shadow-xl border"
                          style={{
                            background: 'rgba(0, 0, 0, 0.95)',
                            borderColor: `${CI.goldLight}40`,
                            backdropFilter: 'blur(20px)'
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="p-1 rounded"
                              style={{ background: `${CI.goldLight}20` }}
                            >
                              <Download className="w-3 h-3" style={{ color: CI.goldLight }} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white mb-0.5">Benötigen Sie eine Vorlage?</p>
                              <p className="text-[10px] text-gray-400">Laden Sie unsere CSV-Vorlage herunter mit Beispieldaten und der richtigen Struktur.</p>
                            </div>
                          </div>
                          {/* Arrow */}
                          <div 
                            className="absolute -top-1 left-4 w-2 h-2 rotate-45"
                            style={{
                              background: `${CI.goldLight}40`,
                              borderLeft: `1px solid ${CI.goldLight}40`,
                              borderTop: `1px solid ${CI.goldLight}40`
                            }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Add Button - HIGH END */}
                <motion.button
                  onClick={() => {
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg transition-all relative overflow-hidden group"
                  style={{
                    background: CI.orange,
                    color: 'black'
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Shimmer Effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{
                      x: ['-100%', '200%']
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                  />
                  <div className="relative flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    <span>Neu</span>
                  </div>
                </motion.button>
            </div>

            {/* Search - MODERN CI */}
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#FE9100]/50" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                />
              </div>
            </div>

            {/* Add/Edit Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="p-4 backdrop-blur-sm bg-black/30 border border-[#FE9100]/20 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: '#FE9100' }}>
                        {editingContact ? 'BEARBEITEN' : 'NEUER KONTAKT'}
                      </h3>
                      <button
                        onClick={resetForm}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="Firma *"
                          className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                        />
                      </div>

                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Vorname"
                        className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                      />

                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Nachname"
                        className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                      />

                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Telefon"
                        className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                      />

                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="E-Mail"
                        className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all"
                      />

                      <div className="col-span-2">
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Notizen"
                          rows={2}
                          className="w-full px-3 py-2 text-xs backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#FE9100]/50 focus:bg-black/30 transition-all resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="flex-1 py-2 text-xs font-medium rounded-md transition-all"
                        style={{
                          background: CI.orange,
                          color: 'black'
                        }}
                      >
                        {saveMutation.isPending ? 'Speichert...' : 'Speichern'}
                      </button>

                      <button
                        onClick={resetForm}
                        className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-400 rounded-md transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contacts List - FLAT CARDS */}
            <div className="space-y-1.5">
              {contactsLoading ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  Lade...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <Contact className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                  <p className="text-sm text-gray-500 mb-3">
                    {searchQuery ? 'Keine Ergebnisse' : 'Keine Kontakte'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="px-4 py-2 text-xs font-medium rounded-md"
                      style={{
                        background: CI.orange,
                        color: 'black'
                      }}
                    >
                      Ersten Kontakt hinzufügen
                    </button>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="group p-3 backdrop-blur-sm bg-black/20 hover:bg-black/30 border border-white/10 hover:border-[#FE9100]/30 rounded-xl transition-all"
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${CI.orange}15`,
                          border: `1px solid ${CI.orange}30`
                        }}
                      >
                        <Building2 className="w-4 h-4" style={{ color: CI.orange }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold text-white mb-1">
                          {contact.company}
                        </h3>
                        
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                          {(contact.firstName || contact.lastName) && (
                            <span>
                              {[contact.firstName, contact.lastName].filter(Boolean).join(' ')}
                            </span>
                          )}
                          {contact.phone && (
                            <span>{contact.phone}</span>
                          )}
                          {contact.email && (
                            <span className="truncate max-w-[150px]">{contact.email}</span>
                          )}
                        </div>

                        {contact.notes && (
                          <p className="mt-1 text-[9px] text-gray-600 line-clamp-1 italic">
                            "{contact.notes}"
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-3 h-3" style={{ color: CI.goldLight }} />
                        </button>

                        <button
                          onClick={() => handleDelete(contact.id!)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
