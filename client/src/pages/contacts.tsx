import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { User, SubscriptionResponse } from '@shared/schema';

/* ═══════════════════════════════════════════════════════════════
   COPY — Alle Strings zentral
   ═══════════════════════════════════════════════════════════════ */
const COPY = {
  pageTitle: 'Kontakte',
  pageSub: 'Suchen, organisieren und Aktionen starten — ohne Reibung.',
  searchPlaceholder: 'Suche nach Name, Firma, E-Mail oder Telefon…',
  addContact: 'Kontakt hinzufügen',
  addContactH: 'Öffnet das Kontaktformular.',
  csvUpload: 'CSV Import',
  csvUploadH: 'Kontaktliste als CSV hochladen (max. 1.000).',
  csvTemplate: 'Vorlage',
  csvTemplateH: 'CSV-Vorlage mit korrektem Format herunterladen.',
  sortLabel: 'Sortierung',
  sortUpdated: 'Zuletzt aktualisiert',
  sortCreated: 'Zuletzt erstellt',
  sortNameAZ: 'Name A–Z',
  sortNameZA: 'Name Z–A',
  sortCompanyAZ: 'Firma A–Z',
  emptyTitle: 'Noch keine Kontakte',
  emptySub: 'Füge deinen ersten Kontakt hinzu oder importiere eine CSV-Datei.',
  emptyBtn: 'Ersten Kontakt hinzufügen',
  errorTitle: 'Kontakte konnten nicht geladen werden',
  errorSub: 'Bitte versuche es erneut.',
  errorReload: 'Neu laden',
  formTitleNew: 'Neuer Kontakt',
  formTitleEdit: 'Kontakt bearbeiten',
  formCompany: 'Firma',
  formCompanyReq: 'Firma ist ein Pflichtfeld.',
  formFirstName: 'Vorname',
  formLastName: 'Nachname',
  formPhone: 'Telefon',
  formEmail: 'E-Mail',
  formNotes: 'Notizen',
  formSave: 'Speichern',
  formSaving: 'Speichern…',
  formCancel: 'Abbrechen',
  formError: 'Speichern nicht möglich — bitte erneut versuchen.',
  detailTitle: 'Kontaktdetails',
  detailEdit: 'Bearbeiten',
  detailEditH: 'Kontaktdaten ändern.',
  detailDelete: 'Löschen',
  detailDeleteH: 'Kontakt unwiderruflich entfernen.',
  detailPowerCall: 'Power Call',
  detailPowerCallH: 'Startet einen Einzelanruf mit ARAS Voice.',
  detailCopied: 'Kopiert',
  detailCreated: 'Erstellt',
  detailUpdated: 'Aktualisiert',
  deleteConfirm: 'Kontakt wirklich löschen?',
  deleteConfirmSub: 'Diese Aktion kann nicht rückgängig gemacht werden.',
  deleteBtn: 'Endgültig löschen',
  bulkSelected: (n: number) => `${n} ausgewählt`,
  bulkDelete: 'Löschen',
  bulkDeleteH: 'Ausgewählte Kontakte entfernen.',
  notLoggedIn: 'Nicht eingeloggt',
};

/* ═══════════════════════════════════════════════════════════════
   ARAS CI TOKENS
   ═══════════════════════════════════════════════════════════════ */
const C = {
  gold: '#e9d7c4', goldDark: '#a34e00', orange: '#FE9100', bgDark: '#0a0a0e',
  glass: 'rgba(255,255,255,0.020)', stroke: 'rgba(233,215,196,0.10)',
  text1: 'rgba(255,255,255,0.92)', text2: 'rgba(255,255,255,0.62)', text3: 'rgba(255,255,255,0.38)',
};
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const orb: React.CSSProperties = { fontFamily: "'Orbitron', sans-serif", fontWeight: 800, letterSpacing: '0.02em' };
const CARD = 'relative rounded-[26px] border backdrop-blur-2xl overflow-hidden';
const CS: React.CSSProperties = { borderColor: C.stroke, background: C.glass };
const CHOV = 'transition-all duration-200 hover:border-[rgba(254,145,0,0.22)]';

/* ═══ TYPES ═══ */
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

type SortKey = 'updatedAt' | 'createdAt' | 'nameAZ' | 'nameZA' | 'companyAZ';

/* ═══ HELPERS ═══ */
function fmtA(ts: string | Date | undefined | null) {
  if (!ts) return '—';
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: de }); } catch { return '—'; }
}

function contactName(c: ContactData) {
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function sortContacts(arr: ContactData[], key: SortKey): ContactData[] {
  const copy = [...arr];
  switch (key) {
    case 'updatedAt': return copy.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    case 'createdAt': return copy.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    case 'nameAZ': return copy.sort((a, b) => (contactName(a) || a.company).localeCompare(contactName(b) || b.company, 'de'));
    case 'nameZA': return copy.sort((a, b) => (contactName(b) || b.company).localeCompare(contactName(a) || a.company, 'de'));
    case 'companyAZ': return copy.sort((a, b) => a.company.localeCompare(b.company, 'de'));
    default: return copy;
  }
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: COPY.sortUpdated },
  { key: 'createdAt', label: COPY.sortCreated },
  { key: 'nameAZ', label: COPY.sortNameAZ },
  { key: 'nameZA', label: COPY.sortNameZA },
  { key: 'companyAZ', label: COPY.sortCompanyAZ },
];

/* ═══ SHARED UI ═══ */
function HintBtn({ children, onClick, hint, primary, disabled, className = '' }: {
  children: React.ReactNode; onClick?: () => void; hint?: string; primary?: boolean; disabled?: boolean; className?: string;
}) {
  const [h, sH] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <button onClick={onClick} disabled={disabled}
        className={`px-4 py-2.5 rounded-full text-[12px] font-semibold tracking-[0.06em] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50 ${className}`}
        style={primary
          ? { border: `1px solid ${C.orange}40`, color: '#fff', background: `linear-gradient(135deg,${C.orange}22,rgba(255,255,255,0.02))`, boxShadow: `0 8px 32px ${C.orange}12` }
          : { border: `1px solid ${C.stroke}`, color: C.text2, background: C.glass }
        }>{children}</button>
      <AnimatePresence>{h && hint && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute top-full mt-1 left-0 text-[9px] whitespace-nowrap z-20" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

function Skel({ h = 60, className = '' }: { h?: number; className?: string }) {
  return <div className={`${CARD} animate-pulse ${className}`} style={{ height: h, borderColor: C.stroke, background: 'rgba(255,255,255,0.015)' }}>
    <div className="p-4"><div className="h-3 w-28 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} /><div className="h-2.5 w-40 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} /></div></div>;
}

function Chip({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-[0.14em] uppercase select-none"
      style={{ border: `1px solid ${warn ? 'rgba(245,158,11,0.25)' : C.stroke}`, background: C.glass, color: warn ? '#f59e0b' : C.gold }}>
      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: warn ? '#f59e0b' : '#22c55e', boxShadow: `0 0 8px ${warn ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.5)'}` }} />
      {label}
    </div>
  );
}

/* ═══ FORM INPUT ═══ */
function FInput({ label, value, onChange, required, type = 'text', multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; multiline?: boolean; placeholder?: string;
}) {
  const id = `fi-${label.replace(/\s/g, '')}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5" style={{ color: C.text3 }}>
        {label}{required && <span style={{ color: C.orange }}> *</span>}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full px-3.5 py-2.5 text-[13px] rounded-2xl border outline-none transition-all duration-200 resize-none focus:border-[rgba(254,145,0,0.4)]"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: C.stroke, color: C.text1 }} />
      ) : (
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3.5 py-2.5 text-[13px] rounded-2xl border outline-none transition-all duration-200 focus:border-[rgba(254,145,0,0.4)]"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: C.stroke, color: C.text1 }} />
      )}
    </div>
  );
}

/* ═══ CONTACT FORM MODAL ═══ */
function ContactFormModal({ contact, onSave, onClose, saving, error }: {
  contact: ContactData | null; onSave: (data: ContactData) => void; onClose: () => void; saving: boolean; error: boolean;
}) {
  const isEdit = !!contact?.id;
  const [form, setForm] = useState<ContactData>({
    company: contact?.company || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    notes: contact?.notes || '',
  });
  const [companyError, setCompanyError] = useState(false);

  const handleSave = () => {
    if (!form.company.trim()) { setCompanyError(true); return; }
    setCompanyError(false);
    onSave(isEdit ? { ...form, id: contact!.id } : form);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: EASE }}
        className={`${CARD} w-full max-w-lg`} style={{ ...CS, background: 'rgba(10,10,14,0.95)', borderColor: `${C.orange}18` }}>
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-bold" style={{ ...orb, color: C.gold }}>{isEdit ? COPY.formTitleEdit : COPY.formTitleNew}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Schließen">
              <span className="text-[14px]" style={{ color: C.text3 }}>✕</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-[12px]" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}>
              {COPY.formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FInput label={COPY.formCompany} value={form.company} onChange={v => { setForm({ ...form, company: v }); setCompanyError(false); }} required />
              {companyError && <p className="text-[10px] mt-1" style={{ color: 'rgba(239,68,68,0.7)' }}>{COPY.formCompanyReq}</p>}
            </div>
            <FInput label={COPY.formFirstName} value={form.firstName || ''} onChange={v => setForm({ ...form, firstName: v })} />
            <FInput label={COPY.formLastName} value={form.lastName || ''} onChange={v => setForm({ ...form, lastName: v })} />
            <FInput label={COPY.formPhone} value={form.phone || ''} onChange={v => setForm({ ...form, phone: v })} type="tel" />
            <FInput label={COPY.formEmail} value={form.email || ''} onChange={v => setForm({ ...form, email: v })} type="email" />
            <div className="sm:col-span-2">
              <FInput label={COPY.formNotes} value={form.notes || ''} onChange={v => setForm({ ...form, notes: v })} multiline />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 rounded-full text-[12px] font-semibold tracking-[0.06em] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${C.orange},${C.goldDark})`, color: '#fff' }}>
              {saving ? COPY.formSaving : COPY.formSave}
            </button>
            <button onClick={onClose}
              className="px-6 py-3 rounded-full text-[12px] font-semibold tracking-[0.06em] transition-all duration-200 hover:bg-white/5"
              style={{ border: `1px solid ${C.stroke}`, color: C.text3 }}>
              {COPY.formCancel}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ DELETE CONFIRM MODAL ═══ */
function DeleteConfirmModal({ name, onConfirm, onClose, deleting }: {
  name: string; onConfirm: () => void; onClose: () => void; deleting: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`${CARD} w-full max-w-sm`} style={{ ...CS, background: 'rgba(10,10,14,0.95)', borderColor: 'rgba(239,68,68,0.2)' }}>
        <div className="p-6">
          <div className="text-[16px] font-bold mb-2" style={{ ...orb, color: C.gold }}>{COPY.deleteConfirm}</div>
          <p className="text-[12px] mb-1" style={{ color: C.text2 }}>"{name}"</p>
          <p className="text-[11px] mb-5" style={{ color: C.text3 }}>{COPY.deleteConfirmSub}</p>
          <div className="flex gap-3">
            <button onClick={onConfirm} disabled={deleting}
              className="flex-1 py-2.5 rounded-full text-[12px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
              {deleting ? 'Löschen…' : COPY.deleteBtn}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-full text-[12px] font-semibold hover:bg-white/5 transition-colors"
              style={{ border: `1px solid ${C.stroke}`, color: C.text3 }}>{COPY.formCancel}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ CONTACT DETAIL DRAWER ═══ */
function ContactDrawer({ contact, onClose, onEdit, onDelete, nav }: {
  contact: ContactData; onClose: () => void; onEdit: () => void; onDelete: () => void; nav: (p: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(null), 1500); });
  };
  const name = contactName(contact);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md overflow-y-auto"
        style={{ background: 'rgba(10,10,14,0.97)', borderLeft: `1px solid ${C.stroke}`, backdropFilter: 'blur(40px)' }}>
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: C.text3 }}>{COPY.detailTitle}</div>
              <h2 className="text-[20px] font-bold mb-1" style={{ ...orb, color: C.gold }}>{contact.company}</h2>
              {name && <p className="text-[14px]" style={{ color: C.text2 }}>{name}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Schließen">
              <span className="text-[14px]" style={{ color: C.text3 }}>✕</span>
            </button>
          </div>

          {/* Contact Info */}
          <div className="space-y-3 mb-6">
            {contact.email && (
              <div className="flex items-center justify-between py-2.5 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${C.stroke}` }}>
                <div>
                  <div className="text-[9px] font-semibold tracking-[0.1em] uppercase mb-0.5" style={{ color: C.text3 }}>E-Mail</div>
                  <div className="text-[13px]" style={{ color: C.text1 }}>{contact.email}</div>
                </div>
                <button onClick={() => copy(contact.email!, 'email')}
                  className="px-2.5 py-1 rounded-full text-[9px] font-semibold hover:bg-white/5 transition-colors"
                  style={{ color: copied === 'email' ? '#22c55e' : C.orange }}>
                  {copied === 'email' ? COPY.detailCopied : 'Kopieren'}
                </button>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center justify-between py-2.5 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${C.stroke}` }}>
                <div>
                  <div className="text-[9px] font-semibold tracking-[0.1em] uppercase mb-0.5" style={{ color: C.text3 }}>Telefon</div>
                  <div className="text-[13px]" style={{ color: C.text1 }}>{contact.phone}</div>
                </div>
                <button onClick={() => copy(contact.phone!, 'phone')}
                  className="px-2.5 py-1 rounded-full text-[9px] font-semibold hover:bg-white/5 transition-colors"
                  style={{ color: copied === 'phone' ? '#22c55e' : C.orange }}>
                  {copied === 'phone' ? COPY.detailCopied : 'Kopieren'}
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="mb-6">
              <div className="text-[10px] font-semibold tracking-[0.1em] uppercase mb-2" style={{ color: C.text3 }}>{COPY.formNotes}</div>
              <div className="text-[12px] leading-relaxed p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${C.stroke}`, color: C.text2 }}>
                {contact.notes}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex gap-4 mb-8">
            {contact.createdAt && (
              <div>
                <div className="text-[9px] font-semibold tracking-[0.1em] uppercase mb-0.5" style={{ color: C.text3 }}>{COPY.detailCreated}</div>
                <div className="text-[11px]" style={{ color: C.text2 }}>{fmtA(contact.createdAt)}</div>
              </div>
            )}
            {contact.updatedAt && (
              <div>
                <div className="text-[9px] font-semibold tracking-[0.1em] uppercase mb-0.5" style={{ color: C.text3 }}>{COPY.detailUpdated}</div>
                <div className="text-[11px]" style={{ color: C.text2 }}>{fmtA(contact.updatedAt)}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <ActionBtn label={COPY.detailPowerCall} hint={COPY.detailPowerCallH} onClick={() => nav(`/app/power?phone=${encodeURIComponent(contact.phone || '')}`)} accent />
            <ActionBtn label={COPY.detailEdit} hint={COPY.detailEditH} onClick={onEdit} />
            <ActionBtn label={COPY.detailDelete} hint={COPY.detailDeleteH} onClick={onDelete} danger />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function ActionBtn({ label, hint, onClick, accent, danger }: { label: string; hint: string; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const [h, sH] = useState(false);
  const clr = danger ? '#ef4444' : accent ? C.orange : C.text2;
  return (
    <div onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <button onClick={onClick}
        className="w-full py-3 rounded-2xl text-[12px] font-semibold tracking-[0.04em] transition-all duration-200 hover:translate-y-[-1px]"
        style={{ border: `1px solid ${clr}25`, color: clr, background: `${clr}08` }}>
        {label}
      </button>
      <AnimatePresence>{h && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="text-[9px] mt-1 ml-1" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CONTACTS COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Contacts() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const nav = useCallback((p: string) => setLocation(p), [setLocation]);
  const csvRef = useRef<HTMLInputElement>(null);

  // Layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handleSectionChange = useCallback((section: string) => setLocation(`/app/${section}`), [setLocation]);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ContactData | null>(null);
  const [detailContact, setDetailContact] = useState<ContactData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  // Subscription for TopBar
  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  // Fetch contacts
  const { data: rawContacts, isLoading, isError, refetch } = useQuery<ContactData[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });
  const contacts = useMemo(() => Array.isArray(rawContacts) ? rawContacts : [], [rawContacts]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = contacts;
    if (q) {
      list = list.filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.firstName?.toLowerCase().includes(q) ||
        c.lastName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }
    return sortContacts(list, sortKey);
  }, [contacts, searchQuery, sortKey]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (contact: ContactData) => {
      const url = contact.id ? `/api/contacts/${contact.id}` : '/api/contacts';
      const method = contact.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(contact) });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowForm(false); setEditTarget(null); setDetailContact(null);
      toast({ title: editTarget ? 'Gespeichert' : 'Hinzugefügt', description: 'Kontakt wurde erfolgreich gespeichert.' });
    },
    onError: () => { toast({ title: 'Fehler', description: 'Kontakt konnte nicht gespeichert werden.', variant: 'destructive' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDeleteTarget(null); setDetailContact(null);
      setSelected(prev => { const n = new Set(prev); n.delete(deleteTarget?.id || ''); return n; });
      toast({ title: 'Gelöscht', description: 'Kontakt wurde entfernt.' });
    },
    onError: () => { toast({ title: 'Fehler', description: 'Kontakt konnte nicht gelöscht werden.', variant: 'destructive' }); },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (data: ContactData[]) => {
      const res = await fetch('/api/contacts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contacts: data }) });
      if (!res.ok) throw new Error('Import failed');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: 'Import erfolgreich', description: `${data?.imported || 0} Kontakte importiert.` });
      setIsUploading(false);
    },
    onError: () => {
      toast({ title: 'Import fehlgeschlagen', description: 'CSV konnte nicht importiert werden.', variant: 'destructive' });
      setIsUploading(false);
    },
  });

  // Handlers
  const openAdd = () => { setEditTarget(null); setShowForm(true); };
  const openEdit = (c: ContactData) => { setEditTarget(c); setShowForm(true); setDetailContact(null); };
  const openDetail = (c: ContactData) => setDetailContact(c);
  const openDelete = (c: ContactData) => { setDeleteTarget(c); setDetailContact(null); };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id!).filter(Boolean)));
  };
  const bulkDelete = async () => {
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i++) { await deleteMutation.mutateAsync(ids[i]).catch(() => {}); }
    setSelected(new Set());
  };

  // CSV Upload
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Ungültiges Format', description: 'Bitte eine CSV-Datei hochladen.', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast({ title: 'Fehler', description: 'CSV muss mindestens Header und eine Zeile enthalten.', variant: 'destructive' }); setIsUploading(false); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const parsed: ContactData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim());
          const c: ContactData = { company: '', firstName: '', lastName: '', phone: '', email: '', notes: '' };
          headers.forEach((h, idx) => {
            const v = vals[idx] || '';
            if (h.includes('firma') || h.includes('company') || h.includes('unternehmen')) c.company = v;
            else if (h.includes('vorname') || h.includes('firstname') || h.includes('first')) c.firstName = v;
            else if (h.includes('nachname') || h.includes('lastname') || h.includes('last')) c.lastName = v;
            else if (h.includes('telefon') || h.includes('phone') || h.includes('tel')) c.phone = v;
            else if (h.includes('email') || h.includes('mail') || h.includes('e-mail')) c.email = v;
            else if (h.includes('notiz') || h.includes('note') || h.includes('bemerkung')) c.notes = v;
          });
          if (c.company.trim()) parsed.push(c);
        }
        if (parsed.length === 0) { toast({ title: 'Fehler', description: 'Keine gültigen Kontakte gefunden. Firma ist Pflichtfeld.', variant: 'destructive' }); setIsUploading(false); return; }
        bulkImportMutation.mutate(parsed);
      } catch { toast({ title: 'CSV Fehler', description: 'Fehler beim Parsen der Datei.', variant: 'destructive' }); setIsUploading(false); }
    };
    reader.onerror = () => { toast({ title: 'Fehler', description: 'Datei konnte nicht gelesen werden.', variant: 'destructive' }); setIsUploading(false); };
    reader.readAsText(file);
    event.target.value = '';
  };

  const downloadCSVTemplate = () => {
    const tpl = 'Firma,Vorname,Nachname,Telefon,Email,Notizen\nBeispiel GmbH,Max,Mustermann,+49123456789,max@beispiel.de,Wichtiger Kunde';
    const blob = new Blob([tpl], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kontakte-vorlage.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Auth loading
  if (authLoading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: C.bgDark }}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: C.orange }} />
    </div>
  );

  return (
    <div className="flex h-screen relative overflow-hidden" style={{ background: C.bgDark }}>
      <Sidebar activeSection="contacts" onSectionChange={handleSectionChange} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopBar currentSection="contacts" subscriptionData={subscriptionData} user={user as User} isVisible={true} />

        <div className="flex-1 overflow-y-auto" style={{ background: `linear-gradient(180deg,${C.bgDark},#07070c)` }}>
          {/* Background aura */}
          <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(1000px 600px at 20% 12%,rgba(254,145,0,0.05),transparent 60%)' }} />

          <div className="relative z-[1] max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-24" role="main" aria-label="Kontaktbuch">

            {/* ── A) HEADER ── */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-[32px] sm:text-[40px] leading-[1.05] mb-2" style={{ ...orb, color: C.gold }}>{COPY.pageTitle}</h1>
                  <p className="text-[14px] leading-relaxed max-w-lg" style={{ color: C.text2 }}>{COPY.pageSub}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Chip label={`TOTAL: ${contacts.length}`} />
                  <Chip label="SYNC: OK" />
                </div>
              </div>
            </motion.div>

            {/* ── B) COMMAND BAR ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05, ease: EASE }}
              className={`${CARD} ${CHOV} mb-6 sticky top-0 z-20`} style={CS}>
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-0">
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder={COPY.searchPlaceholder}
                      className="w-full pl-4 pr-10 py-2.5 text-[13px] rounded-full border outline-none transition-all duration-200 focus:border-[rgba(254,145,0,0.4)]"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: C.stroke, color: C.text1 }} />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/5"
                        style={{ color: C.text3 }}>✕</button>
                    )}
                  </div>

                  {/* Sort */}
                  <div className="relative">
                    <button onClick={() => setShowSortMenu(!showSortMenu)}
                      className="px-4 py-2.5 rounded-full text-[11px] font-semibold tracking-[0.04em] transition-all hover:bg-white/5 whitespace-nowrap"
                      style={{ border: `1px solid ${C.stroke}`, color: C.text2 }}>
                      {SORT_OPTIONS.find(o => o.key === sortKey)?.label || COPY.sortLabel}
                    </button>
                    <AnimatePresence>
                      {showSortMenu && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className="absolute top-full mt-2 right-0 z-30 min-w-[180px] rounded-2xl border overflow-hidden"
                          style={{ background: 'rgba(10,10,14,0.97)', borderColor: C.stroke, backdropFilter: 'blur(20px)' }}>
                          {SORT_OPTIONS.map(o => (
                            <button key={o.key} onClick={() => { setSortKey(o.key); setShowSortMenu(false); }}
                              className="w-full px-4 py-2.5 text-left text-[11px] font-medium transition-colors hover:bg-white/5"
                              style={{ color: sortKey === o.key ? C.orange : C.text2 }}>
                              {o.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                    <HintBtn onClick={() => csvRef.current?.click()} hint={COPY.csvUploadH} disabled={isUploading}>
                      {isUploading ? 'Importiere…' : COPY.csvUpload}
                    </HintBtn>
                    <HintBtn onClick={downloadCSVTemplate} hint={COPY.csvTemplateH}>{COPY.csvTemplate}</HintBtn>
                    <HintBtn onClick={openAdd} hint={COPY.addContactH} primary>{COPY.addContact}</HintBtn>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Close sort menu on outside click */}
            {showSortMenu && <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />}

            {/* ── BULK ACTION BAR ── */}
            <AnimatePresence>
              {selected.size > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="mb-4 flex items-center gap-3 px-5 py-3 rounded-full" style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}25` }}>
                  <span className="text-[12px] font-semibold" style={{ color: C.orange }}>{COPY.bulkSelected(selected.size)}</span>
                  <div className="flex-1" />
                  <HintBtn onClick={bulkDelete} hint={COPY.bulkDeleteH}>
                    <span style={{ color: '#ef4444' }}>{COPY.bulkDelete}</span>
                  </HintBtn>
                  <button onClick={() => setSelected(new Set())} className="text-[10px] font-semibold px-3 py-1.5 rounded-full hover:bg-white/5" style={{ color: C.text3 }}>
                    Auswahl aufheben
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── C) CONTACTS TABLE ── */}
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => <Skel key={i} h={64} />)}
              </div>
            ) : isError ? (
              <div className={`${CARD} p-8 text-center`} style={{ ...CS, borderColor: 'rgba(239,68,68,0.15)' }}>
                <div className="text-[16px] font-bold mb-2" style={{ ...orb, color: C.gold }}>{COPY.errorTitle}</div>
                <p className="text-[12px] mb-4" style={{ color: C.text3 }}>{COPY.errorSub}</p>
                <button onClick={() => refetch()} className="px-5 py-2.5 rounded-full text-[12px] font-semibold"
                  style={{ border: `1px solid ${C.orange}30`, color: C.orange }}>{COPY.errorReload}</button>
              </div>
            ) : filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                className={`${CARD} p-12 text-center`} style={CS}>
                <div className="text-[18px] font-bold mb-2" style={{ ...orb, color: C.gold }}>
                  {searchQuery ? 'Keine Ergebnisse' : COPY.emptyTitle}
                </div>
                <p className="text-[13px] mb-5 max-w-sm mx-auto" style={{ color: C.text3 }}>
                  {searchQuery ? `Keine Kontakte für "${searchQuery}" gefunden.` : COPY.emptySub}
                </p>
                {!searchQuery && (
                  <div className="flex justify-center gap-3">
                    <HintBtn onClick={openAdd} primary hint={COPY.addContactH}>{COPY.emptyBtn}</HintBtn>
                    <HintBtn onClick={() => csvRef.current?.click()} hint={COPY.csvUploadH}>{COPY.csvUpload}</HintBtn>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
                className={`${CARD}`} style={CS}>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <th className="px-5 py-3 text-left w-10">
                          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-gray-600 accent-[#FE9100] cursor-pointer" />
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: C.text3 }}>Firma</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: C.text3 }}>Name</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase hidden lg:table-cell" style={{ color: C.text3 }}>Kontakt</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase hidden xl:table-cell" style={{ color: C.text3 }}>Notizen</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: C.text3 }}>Aktualisiert</th>
                        <th className="px-5 py-3 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c, idx) => {
                        const name = contactName(c);
                        const isSel = selected.has(c.id!);
                        return (
                          <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                            className="group border-b cursor-pointer transition-colors hover:bg-white/[0.025]"
                            style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                            onClick={() => openDetail(c)}>
                            <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id!)}
                                className="w-3.5 h-3.5 rounded border-gray-600 accent-[#FE9100] cursor-pointer" />
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-[13px] font-semibold" style={{ color: C.text1 }}>{c.company}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-[12px]" style={{ color: name ? C.text2 : C.text3 }}>{name || '—'}</span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <div className="flex flex-col gap-0.5">
                                {c.email && <span className="text-[11px] truncate max-w-[180px]" style={{ color: C.text2 }}>{c.email}</span>}
                                {c.phone && <span className="text-[11px]" style={{ color: C.text3 }}>{c.phone}</span>}
                                {!c.email && !c.phone && <span className="text-[11px]" style={{ color: C.text3 }}>—</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden xl:table-cell">
                              <span className="text-[11px] truncate max-w-[160px] block" style={{ color: C.text3 }}>
                                {c.notes ? (c.notes.length > 40 ? c.notes.slice(0, 40) + '…' : c.notes) : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-[10px]" style={{ color: C.text3 }}>{fmtA(c.updatedAt || c.createdAt)}</span>
                            </td>
                            <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                <button onClick={() => openEdit(c)} className="px-2 py-1 rounded-full text-[9px] font-semibold hover:bg-white/5 transition-colors"
                                  style={{ color: C.gold }} title="Bearbeiten">Bearbeiten</button>
                                <button onClick={() => openDelete(c)} className="px-2 py-1 rounded-full text-[9px] font-semibold hover:bg-red-500/10 transition-colors"
                                  style={{ color: '#ef4444' }} title="Löschen">Löschen</button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-2">
                  {filtered.map((c, idx) => {
                    const name = contactName(c);
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                        className="p-4 rounded-2xl border transition-all hover:border-[rgba(254,145,0,0.2)] cursor-pointer"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                        onClick={() => openDetail(c)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold mb-0.5" style={{ color: C.text1 }}>{c.company}</div>
                            {name && <div className="text-[11px] mb-1" style={{ color: C.text2 }}>{name}</div>}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {c.email && <span className="text-[10px] truncate max-w-[180px]" style={{ color: C.text3 }}>{c.email}</span>}
                              {c.phone && <span className="text-[10px]" style={{ color: C.text3 }}>{c.phone}</span>}
                            </div>
                          </div>
                          <span className="text-[9px] flex-shrink-0" style={{ color: C.text3 }}>{fmtA(c.updatedAt || c.createdAt)}</span>
                        </div>
                        {c.notes && <p className="text-[10px] mt-2 truncate" style={{ color: C.text3 }}>"{c.notes}"</p>}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Count footer */}
                <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[10px]" style={{ color: C.text3 }}>{filtered.length} von {contacts.length} Kontakten</span>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-[10px] font-semibold px-3 py-1 rounded-full hover:bg-white/5" style={{ color: C.orange }}>
                      Filter zurücksetzen
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS & DRAWERS ── */}
      <AnimatePresence>
        {showForm && (
          <ContactFormModal
            contact={editTarget}
            onSave={data => saveMutation.mutate(data)}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
            saving={saveMutation.isPending}
            error={saveMutation.isError}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmModal
            name={deleteTarget.company}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id!)}
            onClose={() => setDeleteTarget(null)}
            deleting={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailContact && (
          <ContactDrawer
            contact={detailContact}
            onClose={() => setDetailContact(null)}
            onEdit={() => openEdit(detailContact)}
            onDelete={() => openDelete(detailContact)}
            nav={nav}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
