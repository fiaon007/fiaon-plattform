/**
 * ARAS Contacts Drawer
 * SlideOver panel with contacts list, search, and quick actions
 * Premium design with real data integration
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, Phone, Calendar, MessageSquare, 
  Building2, Clock, ChevronRight, Users, Sparkles,
  Plus
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { asArray, safeTrim, isValidString } from '@/lib/utils/safe';

const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(10,10,10,0.98)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface Contact {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  lastContact?: string;
  tags?: string[];
}

interface ContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function ContactCard({ contact, onCall, onSchedule }: { 
  contact: Contact; 
  onCall: () => void;
  onSchedule: () => void;
}) {
  const initials = (contact.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="group p-3 rounded-xl transition-all hover:bg-white/5 cursor-pointer"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ 
            background: `linear-gradient(135deg, ${DT.orange}33, ${DT.orange}11)`,
            color: DT.orange,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{contact.name || 'Unbekannt'}</p>
          {contact.company && (
            <p className="text-xs text-white/50 flex items-center gap-1 truncate">
              <Building2 size={10} />
              {contact.company}
            </p>
          )}
          {contact.lastContact && (
            <p className="text-[10px] text-white/30 flex items-center gap-1 mt-0.5">
              <Clock size={9} />
              Letzter Kontakt: {new Date(contact.lastContact).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onCall(); }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Anrufen"
          >
            <Phone size={14} className="text-green-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSchedule(); }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Termin planen"
          >
            <Calendar size={14} className="text-blue-400" />
          </button>
        </div>

        <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
      </div>

      {/* Tags */}
      {asArray(contact.tags).length > 0 && (
        <div className="flex gap-1 mt-2 ml-13">
          {asArray(contact.tags).slice(0, 3).map((tag, i) => (
            <span 
              key={i}
              className="text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,106,0,0.15)', color: DT.orange }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div 
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `linear-gradient(135deg, ${DT.orange}22, ${DT.orange}08)` }}
      >
        <Users size={28} style={{ color: DT.orange }} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">Keine Kontakte</h3>
      <p className="text-xs text-white/50 max-w-[200px] mb-4">
        Importiere Kontakte um mit Calls und Kampagnen zu starten.
      </p>
      <a
        href="/app/contacts"
        className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all hover:scale-105"
        style={{ 
          background: `linear-gradient(135deg, ${DT.orange}, #ff8533)`,
          color: 'white',
        }}
      >
        <Plus size={14} />
        Kontakte importieren
      </a>
    </div>
  );
}

export function ContactsDrawer({ isOpen, onClose }: ContactsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'important'>('all');

  // Fetch contacts
  const { data: contactsRaw, isLoading } = useQuery({
    queryKey: ['contacts-drawer'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/contacts?limit=50', { credentials: 'include' });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  const contacts = asArray<Contact>(contactsRaw);

  // Filter contacts
  const filteredContacts = contacts.filter(c => {
    const query = safeTrim(searchQuery).toLowerCase();
    if (!query) return true;
    const name = safeTrim(c.name).toLowerCase();
    const company = safeTrim(c.company).toLowerCase();
    return name.includes(query) || company.includes(query);
  });

  const handleCall = (contact: Contact) => {
    if (contact.phone) {
      window.location.href = `/app/power/einzelanruf?phone=${encodeURIComponent(contact.phone)}&name=${encodeURIComponent(contact.name || '')}`;
    }
  };

  const handleSchedule = (contact: Contact) => {
    window.location.href = `/app/calendar?contact=${contact.id}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col"
            style={{ 
              background: DT.panelBg,
              borderLeft: `1px solid ${DT.panelBorder}`,
            }}
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${DT.panelBorder}` }}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${DT.orange}22, ${DT.orange}08)` }}
                >
                  <Users size={20} style={{ color: DT.orange }} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Kontakte</h2>
                  <p className="text-xs text-white/50">{contacts.length} Kontakte</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-white/60" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${DT.panelBorder}` }}
              >
                <Search size={16} className="text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suchen..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 flex gap-2" style={{ borderBottom: `1px solid ${DT.panelBorder}` }}>
              {(['all', 'new', 'important'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                    activeTab === tab ? 'text-white' : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {tab === 'all' ? 'Alle' : tab === 'new' ? 'Neu' : 'Wichtig'}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: DT.orange }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : filteredContacts.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onCall={() => handleCall(contact)}
                      onSchedule={() => handleSchedule(contact)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4" style={{ borderTop: `1px solid ${DT.panelBorder}` }}>
              <a
                href="/app/contacts"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
                style={{ border: `1px solid ${DT.panelBorder}` }}
              >
                Alle Kontakte öffnen
                <ChevronRight size={16} />
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ContactsDrawer;
