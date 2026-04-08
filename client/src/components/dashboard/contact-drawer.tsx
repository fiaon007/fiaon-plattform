/**
 * Contact Drawer - Slide-in panel with contact timeline
 * Mission Control V5 — Investor-grade CRM, ESC close, expandable timeline
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Phone, Mail, Building2, Tag, Clock, 
  MessageSquare, Calendar, ArrowRight, Play,
  CheckCircle, AlertCircle, Copy, ChevronDown
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';

// ARAS Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(15,15,18,0.98)',
  panelBorder: 'rgba(255,255,255,0.06)',
};

interface TimelineEvent {
  id: string;
  type: 'call' | 'task' | 'note' | 'campaign';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ContactData {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  tags?: string[];
  createdAt?: string;
}

interface ContactStats {
  totalCalls: number;
  totalTasks: number;
  lastCallAt?: string;
  lastCallSentiment?: string;
  nextStep?: string;
}

interface ContactDrawerProps {
  contactId: string | null;
  onClose: () => void;
  onOpenCall?: (callId: string) => void;
  onAddToCampaign?: (contactId: string) => void;
  onCreateTask?: (contactId: string) => void;
}

function TimelineItem({ 
  event, 
  onOpenCall,
  isLast = false,
}: { 
  event: TimelineEvent; 
  onOpenCall?: (id: string) => void;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  let timeAgo = '';
  let formattedDate = '';
  try {
    const date = new Date(event.timestamp);
    timeAgo = formatDistanceToNow(date, { addSuffix: true, locale: de });
    formattedDate = format(date, "dd.MM.yyyy 'um' HH:mm", { locale: de });
  } catch { /* ignore */ }

  const getIcon = () => {
    switch (event.type) {
      case 'call':
        return <Phone size={12} />;
      case 'task':
        return <CheckCircle size={12} />;
      case 'campaign':
        return <Play size={12} />;
      default:
        return <MessageSquare size={12} />;
    }
  };

  const getColor = () => {
    if (event.type === 'call') {
      const sentiment = event.metadata?.sentiment;
      if (sentiment === 'positive') return '#22c55e';
      if (sentiment === 'negative') return '#ef4444';
      return DT.orange;
    }
    return 'rgba(255,255,255,0.4)';
  };

  const hasExpandableContent = event.description || event.metadata?.bullets || event.metadata?.summary;

  return (
    <div className="flex gap-3 group">
      {/* Timeline dot & line */}
      <div className="flex flex-col items-center">
        <button 
          onClick={() => hasExpandableContent && setExpanded(!expanded)}
          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform ${
            hasExpandableContent ? 'cursor-pointer hover:scale-110' : ''
          }`}
          style={{ background: `${getColor()}20`, color: getColor() }}
        >
          {getIcon()}
        </button>
        {!isLast && <div className="w-px flex-1 bg-white/10 mt-2" />}
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
        <div className="flex items-start justify-between">
          <button 
            onClick={() => hasExpandableContent && setExpanded(!expanded)}
            className="text-left flex-1"
          >
            <p className="text-xs font-medium text-white/80">
              {event.title}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {timeAgo}
            </p>
          </button>
          
          <div className="flex items-center gap-1">
            {hasExpandableContent && (
              <ChevronDown 
                size={12} 
                className={`text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} 
              />
            )}
            {event.type === 'call' && event.metadata?.callId && (
              <button
                onClick={() => onOpenCall?.(String(event.metadata?.callId))}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-white/10"
                title="Call öffnen"
              >
                <ArrowRight size={12} className="text-white/40" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-white/5">
                {/* Date */}
                <p className="text-[9px] text-white/30 mb-2">{formattedDate}</p>

                {/* Description */}
                {event.description && (
                  <p className="text-[11px] text-white/60 mb-2">
                    {event.description}
                  </p>
                )}

                {/* Bullets */}
                {event.metadata?.bullets && Array.isArray(event.metadata.bullets) && (
                  <ul className="text-[10px] text-white/50 space-y-1 mb-2">
                    {event.metadata.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-white/30 mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Outcome badge */}
                {event.metadata?.outcome && (
                  <span 
                    className="inline-block px-2 py-0.5 rounded text-[9px] font-medium mb-2"
                    style={{ 
                      background: `${getColor()}15`, 
                      color: getColor() 
                    }}
                  >
                    {event.metadata.outcome}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Step - always visible */}
        {event.metadata?.nextStep && (
          <div 
            className="mt-2 p-2 rounded-lg text-[10px]"
            style={{ background: `${DT.orange}10`, color: DT.orange }}
          >
            Nächster Schritt: {event.metadata.nextStep}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/10" />
        <div className="flex-1">
          <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded-lg bg-white/10" />
            <div className="flex-1">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-1" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactDrawer({
  contactId,
  onClose,
  onOpenCall,
  onAddToCampaign,
  onCreateTask,
}: ContactDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isOpen = Boolean(contactId);

  // ESC key handler + Focus management + Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        return;
      }

      // Focus trap: Tab cycling
      if (e.key === 'Tab' && isOpen && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    if (isOpen) {
      // Save the element that was focused before opening
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      document.addEventListener('keydown', handleKeyDown);
      // Focus the drawer when it opens
      setTimeout(() => {
        const firstFocusable = drawerRef.current?.querySelector('button:not([disabled])') as HTMLElement;
        firstFocusable?.focus();
      }, 50);
    } else {
      // Return focus to the element that opened the drawer
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Fetch data
  useEffect(() => {
    if (!contactId) {
      setContact(null);
      setTimeline([]);
      setStats(null);
      return;
    }

    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/dashboard/contacts/${contactId}/timeline`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setContact(data.contact);
          setTimeline(data.timeline || []);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch contact timeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [contactId]);

  // Copy summary handler
  const handleCopySummary = useCallback(async () => {
    if (!stats?.nextStep && timeline.length === 0) return;
    
    const summaryParts = [];
    if (contact?.name) summaryParts.push(`Kontakt: ${contact.name}`);
    if (contact?.company) summaryParts.push(`Firma: ${contact.company}`);
    if (stats?.nextStep) summaryParts.push(`\nNächster Schritt: ${stats.nextStep}`);
    if (stats?.totalCalls) summaryParts.push(`\nAnrufe: ${stats.totalCalls}`);
    
    const text = summaryParts.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.error('Failed to copy');
    }
  }, [contact, stats, timeline]);

  // Generate follow-up draft
  const handleCreateFollowupDraft = useCallback(() => {
    if (!contact?.name) return;
    
    const draft = `Hallo ${contact.name},

vielen Dank für unser Gespräch. ${stats?.nextStep ? `Wie besprochen: ${stats.nextStep}` : 'Ich melde mich wie vereinbart.'}

Bei Fragen stehe ich gerne zur Verfügung.

Mit freundlichen Grüßen`;
    
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [contact, stats]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            style={{
              background: 'rgba(0,0,0,0.60)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] z-51 overflow-y-auto"
            style={{
              background: 'rgba(15,15,18,0.98)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
            }}
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${DT.panelBorder}` }}
            >
              <h2 
                id="contact-drawer-title"
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: DT.gold }}
              >
                Kontakt
              </h2>
              <div className="flex items-center gap-2">
                {/* Copy Summary */}
                <button
                  onClick={handleCopySummary}
                  className="p-2 rounded-xl transition-all hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                  title="Zusammenfassung kopieren"
                >
                  {copied ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="text-white/40" />
                  )}
                </button>
                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl transition-all hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                  title="Schließen (ESC)"
                >
                  <X size={16} className="text-white/60" />
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton />
            ) : contact ? (
              <div className="h-full overflow-y-auto pb-20">
                {/* Contact Info */}
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
                      style={{ background: `${DT.orange}20`, color: DT.orange }}
                    >
                      {contact.name?.charAt(0) || '?'}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {contact.name}
                      </h3>
                      
                      {contact.company && (
                        <p className="text-xs text-white/50 flex items-center gap-1 mt-1">
                          <Building2 size={10} />
                          {contact.company}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="mt-4 space-y-2">
                    {contact.phone && (
                      <a 
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
                      >
                        <Phone size={12} />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a 
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
                      >
                        <Mail size={12} />
                        {contact.email}
                      </a>
                    )}
                  </div>

                  {/* Tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {contact.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                        >
                          <Tag size={8} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {stats && (
                    <div 
                      className="mt-4 p-3 rounded-xl grid grid-cols-2 gap-3"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div>
                        <p className="text-[10px] text-white/40">Anrufe</p>
                        <p className="text-sm font-semibold text-white">{stats.totalCalls}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40">Aufgaben</p>
                        <p className="text-sm font-semibold text-white">{stats.totalTasks}</p>
                      </div>
                    </div>
                  )}

                  {/* Next Step */}
                  {stats?.nextStep && (
                    <div 
                      className="mt-4 p-3 rounded-xl"
                      style={{ background: `${DT.orange}10`, borderLeft: `3px solid ${DT.orange}` }}
                    >
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DT.orange }}>
                        Nächster Schritt
                      </p>
                      <p className="text-xs text-white/80">
                        {stats.nextStep}
                      </p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => onCreateTask?.(String(contact.id))}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-all hover:bg-white/10"
                      style={{ border: `1px solid ${DT.panelBorder}`, color: 'white' }}
                    >
                      <Calendar size={12} />
                      Task erstellen
                    </button>
                    <button
                      onClick={() => onAddToCampaign?.(String(contact.id))}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-white transition-all hover:scale-105"
                      style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
                    >
                      <Play size={12} />
                      In Kampagne
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div 
                  className="px-6 py-4"
                  style={{ borderTop: `1px solid ${DT.panelBorder}` }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[10px] uppercase tracking-wider text-white/40">
                      Aktivitäten ({timeline.length})
                    </h4>
                    {timeline.length > 0 && (
                      <button
                        onClick={handleCreateFollowupDraft}
                        className="text-[9px] text-white/40 hover:text-white/60 transition-colors"
                        title="Follow-up Draft kopieren"
                      >
                        {copied ? 'Kopiert!' : 'Draft kopieren'}
                      </button>
                    )}
                  </div>

                  {timeline.length > 0 ? (
                    <div>
                      {timeline.map((event, index) => (
                        <TimelineItem 
                          key={event.id} 
                          event={event} 
                          onOpenCall={onOpenCall}
                          isLast={index === timeline.length - 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock size={20} className="mx-auto text-white/20 mb-2" />
                      <p className="text-xs text-white/40">Keine Aktivitäten</p>
                      <p className="text-[10px] text-white/30 mt-1">
                        Starte einen Anruf um Aktivitäten zu erfassen
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <AlertCircle size={24} className="mx-auto text-white/20 mb-2" />
                <p className="text-xs text-white/40">Kontakt nicht gefunden</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ContactDrawer;
