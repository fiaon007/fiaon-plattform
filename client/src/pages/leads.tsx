/**
 * ============================================================================
 * WISSENSDATENBANK — ARAS AI Knowledge Base (Premium)
 * ============================================================================
 * ARAS CI: Orbitron headlines, glass cards, no icons, gold/orange.
 * 2-column layout, analysis overlay with operator lines, sticky banner,
 * right-side console, skeleton loading, hover hints, premium buttons.
 * Voice-sync safe: all data flows through aiProfile → context-builder.
 * ============================================================================
 */
import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/* ── COPY (all user-facing strings) ── */
const COPY = {
  pageTitle: 'Wissensdatenbank',
  pageSub: 'Alles, was ARAS über dein Unternehmen weiß — live synced für deine Telefon-KI.',
  syncLive: 'Sync: Live',
  syncHint: 'Diese Daten nutzt ARAS in jedem Anruf.',
  analyseIdle: 'Analyse: Bereit',
  analyseRunning: 'Analyse: Aktiv',
  bannerTitle: 'ARAS AI analysiert gerade dein Unternehmen',
  bannerSub: 'Deine Wissensdatenbank wird automatisch aktualisiert. Du kannst währenddessen weiterarbeiten.',
  overlayTitle: 'ARAS arbeitet im Hintergrund',
  overlayDismiss: 'Im Hintergrund weiterlaufen lassen',
  overlayDuration: 'Dauer meist 20–60 Sekunden.',
  emptyTitle: 'Noch keine Wissensdatenbank',
  emptySub: 'Füge Quellen hinzu oder starte eine neue Business-Analyse.',
  hintShow: 'Zeigt den extrahierten Inhalt (nur für dich sichtbar).',
  hintDelete: 'Entfernt diese Quelle dauerhaft aus deiner Wissensdatenbank.',
  formNote: 'Diese Angaben werden in deiner Wissensdatenbank gespeichert und von der Telefon-KI verwendet.',
};

/* ── Types ── */
interface DataSource { id: number; userId: string; type: string; title: string; status: string; contentText: string; url: string; fileName: string | null; createdAt: string; updatedAt: string; }
interface ProfileCtx { id: string; name: string; firstName: string | null; lastName: string | null; company: string | null; website: string | null; industry: string | null; jobRole: string | null; phone: string | null; aiProfile: any; profileEnriched: boolean; enrichmentStatus: string | null; lastEnrichmentDate: string | null; }

/* ── Design Tokens ── */
const C = { gold: '#e9d7c4', goldDark: '#a34e00', orange: '#FE9100', bgDark: '#0a0a0e', stroke: 'rgba(233,215,196,0.10)', strokeHover: 'rgba(254,145,0,0.22)', glass: 'rgba(255,255,255,0.018)', glassHover: 'rgba(255,255,255,0.032)', text1: 'rgba(245,245,247,0.92)', text2: 'rgba(245,245,247,0.56)', text3: 'rgba(245,245,247,0.35)' } as const;
const orb: React.CSSProperties = { fontFamily: "'Orbitron',system-ui,sans-serif", fontWeight: 800, letterSpacing: '0.03em' };
const CARD = "relative rounded-[26px] border backdrop-blur-2xl overflow-hidden";
const CB = "border-[rgba(233,215,196,0.10)]";
const CS = "shadow-[0_24px_80px_rgba(0,0,0,0.50)]";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Helpers ── */
const trim = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter(Boolean) : []);
function normalizeDS(raw: any): DataSource[] {
  if (!raw) return [];
  const a = Array.isArray(raw) ? raw : Array.isArray(raw?.dataSources) ? raw.dataSources : Array.isArray(raw?.sources) ? raw.sources : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : [];
  return a.filter(Boolean).map((s: any) => ({ id: s.id ?? 0, userId: s.userId ?? s.user_id ?? '', type: s.type ?? 'text', title: s.title ?? '', status: s.status ?? 'active', contentText: s.contentText ?? s.content_text ?? s.content_preview ?? '', url: s.url ?? '', fileName: s.fileName ?? s.file_name ?? null, createdAt: s.createdAt ?? s.created_at ?? '', updatedAt: s.updatedAt ?? s.updated_at ?? '' }));
}
const fmtD = (v: string | Date | null | undefined): string => { if (!v) return '—'; try { const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? '—' : format(d, 'dd.MM.yyyy', { locale: de }); } catch { return '—'; } };
const fmtA = (v: string | Date | null | undefined): string => { if (!v) return '—'; try { const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? '—' : formatDistanceToNow(d, { locale: de, addSuffix: true }); } catch { return '—'; } };

/* ── Analysis Phases ── */
const PHASES = [
  { key: 'web', label: 'Website Scan' }, { key: 'icp', label: 'ICP & Positionierung' },
  { key: 'offer', label: 'Angebot & Einwände' }, { key: 'news', label: 'News & Marktdaten' },
  { key: 'kb', label: 'Knowledge Base' }, { key: 'sync', label: 'Voice Sync' },
];

/* ── Error Boundary ── */
class EB extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(p: { children: ReactNode }) { super(p); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[LEADS]', e, i); }
  render() {
    if (this.state.hasError) return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className={`${CARD} ${CB} ${CS} bg-[rgba(255,255,255,0.018)] p-8 max-w-md text-center`}>
          <h2 className="text-lg font-semibold text-white mb-2" style={orb}>Fehler aufgetreten</h2>
          <p className="text-sm mb-4" style={{ color: C.text2 }}>Die Wissensdatenbank konnte nicht geladen werden.</p>
          <pre className="text-xs text-red-300/70 bg-black/40 p-3 rounded-2xl border border-red-500/20 overflow-auto max-h-24 mb-5 text-left">{this.state.error?.message || 'Unbekannter Fehler'}</pre>
          <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-full text-[13px] font-semibold" style={{ border: `1px solid ${C.stroke}`, color: C.gold, background: C.glass }}>Seite neu laden</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

/* ── Buttons ── */
function BtnP({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold tracking-[0.01em] whitespace-nowrap cursor-pointer select-none transition-all duration-200 disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0 ${className}`}
    style={{ border: '1.5px solid rgba(254,145,0,0.30)', background: 'linear-gradient(180deg,rgba(254,145,0,0.16),rgba(255,255,255,0.02))', color: 'rgba(255,255,255,0.96)', boxShadow: '0 18px 64px rgba(254,145,0,0.10)' }}>{children}</button>;
}
function BtnS({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer select-none transition-all duration-200 backdrop-blur-xl disabled:opacity-40 hover:-translate-y-0.5 hover:border-[rgba(254,145,0,0.26)] ${className}`}
    style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: C.text1 }}>{children}</button>;
}
function TL({ children, onClick, danger, className = '' }: { children: ReactNode; onClick?: () => void; danger?: boolean; className?: string; onMouseEnter?: any; onMouseLeave?: any }) {
  return <button onClick={onClick} className={`text-[11px] tracking-[0.08em] uppercase font-semibold transition-colors duration-150 cursor-pointer ${danger ? 'text-red-400/50 hover:text-red-400/90' : 'text-white/[0.35] hover:text-white/[0.70]'} ${className}`}>{children}</button>;
}

/* ── Status Chip ── */
function Chip({ label, hint, live }: { label: string; hint: string; live?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border backdrop-blur-xl cursor-default transition-colors duration-200"
        style={{ borderColor: h ? C.strokeHover : C.stroke, background: h ? C.glassHover : C.glass }}>
        {live !== undefined && <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: live ? `linear-gradient(180deg,${C.orange},${C.goldDark})` : 'rgba(255,255,255,0.20)', boxShadow: live ? '0 0 12px rgba(254,145,0,0.45)' : 'none' }} />}
        <span className="text-[11px] tracking-[0.18em] uppercase font-semibold" style={{ color: 'rgba(233,215,196,0.90)' }}>{label}</span>
      </div>
      <AnimatePresence>{h && <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }} className="absolute top-full left-0 mt-2 text-[11px] whitespace-nowrap z-10" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ── Skeleton ── */
function Sk({ h = 14, w = '100%', className = '' }: { h?: number; w?: string | number; className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ height: h, width: w, background: 'rgba(255,255,255,0.04)' }} />;
}
function SkCard({ n = 4 }: { n?: number }) {
  return <div className={`${CARD} ${CB} ${CS} bg-[rgba(255,255,255,0.018)] p-6`}><Sk h={12} w={120} className="mb-5" />{Array.from({ length: n }).map((_, i) => <div key={i} className="mb-4"><Sk h={8} w={80} className="mb-2" /><Sk h={14} w={i % 2 === 0 ? '90%' : '70%'} /></div>)}</div>;
}

/* ── FieldRow ── */
function FR({ label, value, editing, editValue, onChange, placeholder, multi, error }: {
  label: string; value: string; editing: boolean; editValue?: string; onChange?: (v: string) => void; placeholder?: string; multi?: boolean; error?: string;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: C.text3 }}>{label}</div>
      {editing ? (<>{multi ? (
        <Textarea value={editValue ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl min-h-[80px] focus:border-[#FE9100]/40 focus:ring-[#FE9100]/20 transition-colors" />
      ) : (
        <Input value={editValue ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl h-10 focus:border-[#FE9100]/40 focus:ring-[#FE9100]/20 transition-colors" />
      )}{error && <div className="text-xs text-red-400 mt-1.5">{error}</div>}</>
      ) : (
        <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap" style={{ color: C.text1 }}>{value || <span style={{ color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>Nicht angegeben</span>}</div>
      )}
    </div>
  );
}

/* ── SectionCard ── */
function SC({ title, children, editing, onToggleEdit, onSave, onCancel, saving, className = '' }: {
  title: string; children: ReactNode; editing?: boolean; onToggleEdit?: () => void; onSave?: () => void; onCancel?: () => void; saving?: boolean; className?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      className={`${CARD} ${CB} ${CS} bg-[rgba(255,255,255,0.018)] p-6 group/card hover:border-[rgba(254,145,0,0.14)] transition-colors duration-300 ${className}`}>
      <div className="absolute inset-0 rounded-[26px] pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
        style={{ background: 'radial-gradient(600px 200px at 50% 0%,rgba(254,145,0,0.05),transparent 60%)' }} />
      <div className="relative z-[1]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-5 rounded-full" style={{ background: `linear-gradient(180deg,${C.orange},${C.goldDark})` }} />
            <h3 className="text-[13px]" style={{ ...orb, color: C.gold }}>{title}</h3>
          </div>
          {onToggleEdit && !editing && <TL onClick={onToggleEdit}>Bearbeiten</TL>}
          {editing && <div className="flex items-center gap-4"><TL onClick={onCancel}>Abbrechen</TL><TL onClick={onSave} className={saving ? 'opacity-50 pointer-events-none' : ''}>{saving ? 'Speichern...' : 'Speichern'}</TL></div>}
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/* ── Analysis Banner (sticky) ── */
function ABanner({ running, phase, total }: { running: boolean; phase: number; total: number }) {
  if (!running) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="sticky top-0 z-30">
      <div className="rounded-[22px] border backdrop-blur-2xl p-5" style={{ borderColor: 'rgba(254,145,0,0.18)', background: 'rgba(10,10,14,0.92)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-[9px] h-[9px] rounded-full flex-shrink-0 mt-1.5 animate-[pulse_1.5s_ease-in-out_infinite]" style={{ background: C.orange, boxShadow: '0 0 16px rgba(254,145,0,0.55)' }} />
            <div>
              <div className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ ...orb, color: C.gold, fontSize: 11 }}>{COPY.bannerTitle}</div>
              <div className="text-[13px] mt-1" style={{ color: C.text2 }}>{COPY.bannerSub}</div>
            </div>
          </div>
          <div className="text-[11px] tracking-[0.12em] uppercase font-semibold whitespace-nowrap" style={{ color: 'rgba(233,215,196,0.70)' }}>Phase {phase}/{total}</div>
        </div>
        <div className="mt-3 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${C.gold},${C.orange},${C.goldDark},${C.gold})`, backgroundSize: '300% 100%' }}
            animate={{ width: `${(phase / total) * 100}%`, backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ width: { duration: 0.6 }, backgroundPosition: { duration: 4, repeat: Infinity, ease: 'linear' } }} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Analysis Console (right panel) ── */
function ACon({ running, ps, logs, eStatus, conf, att, lastUp, errCode }: {
  running: boolean; ps: Record<string, string>; logs: string[]; eStatus: string; conf?: string; att?: number; lastUp?: string; errCode?: string;
}) {
  return (
    <SC title="Analyse-Konsole">
      <div className="space-y-2.5 mb-5">
        {PHASES.map(({ key, label }) => { const s = ps[key] || 'queued'; return (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-wide" style={{ color: s === 'done' ? C.text1 : s === 'running' ? C.gold : C.text3 }}>{label}</span>
            <span className="text-[10px] tracking-[0.16em] uppercase font-bold" style={{ color: s === 'done' ? 'rgba(74,222,128,0.80)' : s === 'running' ? C.orange : 'rgba(255,255,255,0.20)' }}>{s === 'done' ? 'DONE' : s === 'running' ? 'RUNNING' : 'QUEUED'}</span>
          </div>
        ); })}
      </div>
      {logs.length > 0 && <div className="border-t pt-3 mb-4" style={{ borderColor: C.stroke }}><div className="space-y-1.5 max-h-[120px] overflow-y-auto">{logs.map((l, i) => <div key={i} className="text-[11px] leading-relaxed" style={{ color: C.text3 }}>{l}</div>)}</div></div>}
      <div className="border-t pt-4 space-y-3" style={{ borderColor: C.stroke }}>
        <MR l="Status" v={running ? 'ARAS arbeitet…' : eStatus === 'live_research' ? 'Live Research abgeschlossen' : eStatus === 'queued' ? 'In Warteschlange' : 'Basis-Profil'} hi={running} />
        {conf && <MR l="Konfidenz" v={conf} />}
        {att !== undefined && <MR l="Versuche" v={String(att)} />}
        {errCode && <MR l="Letzter Fehler" v={errCode} err />}
        <MR l="Letzte Aktualisierung" v={lastUp ? fmtA(lastUp) : '—'} />
      </div>
    </SC>
  );
}
function MR({ l, v, hi, err }: { l: string; v: string; hi?: boolean; err?: boolean }) {
  return <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1" style={{ color: C.text3 }}>{l}</div><div className="text-[13px]" style={{ color: err ? 'rgba(248,113,113,0.70)' : hi ? C.orange : C.text2 }}>{v}</div></div>;
}

/* ── Source Row ── */
function SRow({ src, expanded, onToggle, onDel }: { src: DataSource; expanded: boolean; onToggle: () => void; onDel: () => void }) {
  const [hint, setHint] = useState<string | null>(null);
  const tc = src.type === 'url' ? '#60a5fa' : src.type === 'text' ? '#4ade80' : '#c084fc';
  const tb = src.type === 'url' ? '#3b82f620' : src.type === 'text' ? '#22c55e20' : '#a855f720';
  return (
    <div className="rounded-2xl border transition-colors duration-200 overflow-hidden group/row hover:border-[rgba(254,145,0,0.22)]" style={{ borderColor: C.stroke, background: C.glass }}>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.16em] uppercase px-2.5 py-0.5 rounded-full border" style={{ borderColor: tb, color: tc }}>{src.type}</span>
            <span className="text-[14px] font-medium truncate" style={{ color: C.text1 }}>{src.title || 'Ohne Titel'}</span>
          </div>
          {src.url && <div className="text-[12px] truncate mb-1" style={{ color: C.text3 }}>{src.url}</div>}
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{fmtA(src.updatedAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-3">
            {src.contentText && <button onClick={onToggle} onMouseEnter={() => setHint('show')} onMouseLeave={() => setHint(null)} className="text-[11px] tracking-[0.08em] uppercase font-semibold text-white/[0.35] hover:text-white/[0.70] transition-colors">{expanded ? 'Ausblenden' : 'Anzeigen'}</button>}
            <button onClick={() => { if (confirm('Quelle wirklich löschen?')) onDel(); }} onMouseEnter={() => setHint('del')} onMouseLeave={() => setHint(null)} className="text-[11px] tracking-[0.08em] uppercase font-semibold text-red-400/50 hover:text-red-400/90 transition-colors">Löschen</button>
          </div>
          <AnimatePresence>{hint && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-right max-w-[200px]" style={{ color: C.text3 }}>{hint === 'show' ? COPY.hintShow : COPY.hintDelete}</motion.div>}</AnimatePresence>
        </div>
      </div>
      <AnimatePresence>{expanded && src.contentText && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
          <div className="px-4 pb-4"><pre className="p-4 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-auto" style={{ background: 'rgba(0,0,0,0.30)', border: `1px solid ${C.stroke}`, color: C.text2 }}>{src.contentText}</pre></div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
function LeadsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editSec, setEditSec] = useState<string | null>(null);
  const [pForm, setPForm] = useState<Record<string, string>>({});
  const [aiForm, setAiForm] = useState<Record<string, any>>({});
  const [fErr, setFErr] = useState<Record<string, string>>({});
  const [topErr, setTopErr] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAddSrc, setShowAddSrc] = useState(false);
  const [expSrc, setExpSrc] = useState<Set<number>>(new Set());

  // Analysis UI state
  const [aRunning, setARunning] = useState(false);
  const [aPhase, setAPhase] = useState(0);
  const [aPS, setAPS] = useState<Record<string, string>>({});
  const [aLogs, setALogs] = useState<string[]>([]);
  const aTRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Queries ── */
  const { data: ctx, isLoading: ctxL } = useQuery<ProfileCtx>({ queryKey: ['/api/user/profile-context'], staleTime: 30000, retry: 1 });
  const { data: ds = [], isLoading: dsL } = useQuery<DataSource[]>({
    queryKey: ['/api/user/data-sources'],
    queryFn: async () => { const r = await fetch('/api/user/data-sources', { credentials: 'include' }); if (!r.ok) throw new Error('fail'); return normalizeDS(await r.json()); },
    staleTime: 30000, retry: 1,
  });
  const { data: dig } = useQuery<{ digest: string; sourceCount: number }>({
    queryKey: ['/api/user/knowledge/digest', 'space'],
    queryFn: async () => { const r = await fetch('/api/user/knowledge/digest?mode=space', { credentials: 'include' }); if (!r.ok) throw new Error('fail'); return r.json(); },
    staleTime: 60000,
  });
  const { data: sub } = useQuery<any>({ queryKey: ['/api/user/subscription'], staleTime: 60000, retry: false });
  const ai = ctx?.aiProfile || {};

  /* ── Mutations ── */
  const profM = useMutation({
    mutationFn: async (b: Record<string, any>) => { const r = await fetch('/api/user/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const d = await r.json(); if (!r.ok) throw { status: r.status, ...d }; return d; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/user/profile-context'] }); qc.invalidateQueries({ queryKey: ['/api/auth/me'] }); toast({ title: 'Profil aktualisiert' }); setEditSec(null); setFErr({}); setTopErr(''); },
    onError: (e: any) => { if (e.code === 'USERNAME_TAKEN') setFErr({ username: e.message }); else if (e.code === 'EMAIL_TAKEN') setFErr({ email: e.message }); else if (e.field) setFErr({ [e.field]: e.message }); else setTopErr(e.message || 'Fehler'); },
  });
  const aiM = useMutation({
    mutationFn: async (b: Record<string, any>) => { const r = await fetch('/api/user/ai-profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error('fail'); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/user/profile-context'] }); qc.invalidateQueries({ queryKey: ['/api/user/knowledge/digest'] }); toast({ title: 'Wissensdatenbank aktualisiert' }); setEditSec(null); },
    onError: () => { setTopErr('Fehler beim Speichern.'); },
  });
  const delM = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/user/data-sources/${id}`, { method: 'DELETE', credentials: 'include' }); if (!r.ok) throw new Error('fail'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/user/data-sources'] }); qc.invalidateQueries({ queryKey: ['/api/user/knowledge/digest'] }); toast({ title: 'Quelle gelöscht' }); },
  });
  const addM = useMutation({
    mutationFn: async (b: { type: string; title: string; contentText?: string; url?: string }) => { const r = await fetch('/api/user/data-sources', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error('fail'); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/user/data-sources'] }); qc.invalidateQueries({ queryKey: ['/api/user/knowledge/digest'] }); setShowAddSrc(false); toast({ title: 'Quelle hinzugefügt' }); },
  });

  /* ── Analysis phase simulation ── */
  const startPhases = useCallback(() => {
    setARunning(true); setAPhase(0);
    const init: Record<string, string> = {}; PHASES.forEach(p => { init[p.key] = 'queued'; }); setAPS(init);
    setALogs(['Analyse-Request gestartet…']);
    let p = 0;
    aTRef.current = setInterval(() => {
      if (p >= PHASES.length) { if (aTRef.current) clearInterval(aTRef.current); return; }
      const cur = PHASES[p].key; const prev = p > 0 ? PHASES[p - 1].key : null;
      setAPS(old => ({ ...old, ...(prev ? { [prev]: 'done' } : {}), [cur]: 'running' }));
      setAPhase(p + 1); setALogs(old => [...old, `${PHASES[p].label}…`]); p++;
    }, 5500);
  }, []);
  const stopPhases = useCallback((ok: boolean) => {
    if (aTRef.current) clearInterval(aTRef.current);
    const fin: Record<string, string> = {}; PHASES.forEach(p => { fin[p.key] = 'done'; }); setAPS(fin);
    setAPhase(PHASES.length); setALogs(old => [...old, ok ? 'Wissensdatenbank aktualisiert ✓' : 'Analyse abgeschlossen (teilweise)']);
    setTimeout(() => { setARunning(false); setAPhase(0); setAPS({}); setALogs([]); }, 5000);
  }, []);
  useEffect(() => () => { if (aTRef.current) clearInterval(aTRef.current); }, []);

  /* ── Edit helpers ── */
  const startEd = useCallback((s: string) => {
    setFErr({}); setTopErr('');
    if (s === 'account') setPForm({ username: user?.username || '', email: (user as any)?.email || '', firstName: (user as any)?.firstName || '', lastName: (user as any)?.lastName || '' });
    else if (s === 'company') setPForm({ username: user?.username || '', email: (user as any)?.email || '', firstName: (user as any)?.firstName || '', lastName: (user as any)?.lastName || '', company: ctx?.company || '', website: ctx?.website || '', industry: ctx?.industry || '', jobRole: ctx?.jobRole || '', phone: ctx?.phone || '' });
    else if (s === 'business' || s === 'deep') setAiForm({ ...ai });
    setEditSec(s);
  }, [user, ctx, ai]);
  const saveProf = useCallback(() => { profM.mutate({ username: pForm.username, email: pForm.email, firstName: pForm.firstName, lastName: pForm.lastName, company: pForm.company || (ctx?.company ?? ''), website: pForm.website || (ctx?.website ?? ''), industry: pForm.industry || (ctx?.industry ?? ''), jobRole: pForm.jobRole || (ctx?.jobRole ?? ''), phone: pForm.phone || (ctx?.phone ?? '') }); }, [pForm, ctx, profM]);
  const saveCo = useCallback(() => { profM.mutate({ username: user?.username || '', email: (user as any)?.email || '', firstName: (user as any)?.firstName || '', lastName: (user as any)?.lastName || '', company: pForm.company, website: pForm.website, industry: pForm.industry, jobRole: pForm.jobRole, phone: pForm.phone }); }, [pForm, user, profM]);
  const saveAi = useCallback(() => { aiM.mutate(aiForm); }, [aiForm, aiM]);

  /* ── Loading ── */
  if (ctxL) return (
    <div className="flex-1 overflow-y-auto" style={{ background: `linear-gradient(180deg,${C.bgDark} 0%,#07070c 100%)` }}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Sk h={32} w={260} className="mb-3" /><Sk h={14} w={400} className="mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6"><SkCard n={4} /><SkCard n={5} /></div>
          <div className="lg:col-span-5 space-y-6"><SkCard n={6} /><SkCard n={3} /></div>
        </div>
      </div>
    </div>
  );

  const plan = sub?.plan || (user as any)?.subscriptionPlan || 'starter';
  const enriched = ctx?.profileEnriched;
  const eStatus = ai?.enrichmentMeta?.status || ai?.enrichmentStatus || (enriched ? 'live_research' : 'fallback');
  const isServerRun = eStatus === 'queued' || eStatus === 'in_progress';
  const isRun = aRunning || isServerRun;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: `linear-gradient(180deg,${C.bgDark} 0%,#07070c 100%)` }}>
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(1200px 700px at 18% 10%,rgba(254,145,0,0.06),transparent 62%),radial-gradient(900px 560px at 86% 18%,rgba(233,215,196,0.04),transparent 64%)' }} />
      <div className="relative z-[1] max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-24 space-y-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
            <div>
              <h1 className="text-[32px] sm:text-[40px] leading-[1.05] mb-2.5" style={{ ...orb, color: C.gold }}>{COPY.pageTitle}</h1>
              <p className="text-[15px] leading-relaxed max-w-xl" style={{ color: C.text2 }}>{COPY.pageSub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Chip label={COPY.syncLive} hint={COPY.syncHint} live />
              <Chip label={ctx?.lastEnrichmentDate ? fmtA(ctx.lastEnrichmentDate) : '—'} hint="Zeitpunkt der letzten Analyse" />
              <Chip label={isRun ? COPY.analyseRunning : COPY.analyseIdle} hint={isRun ? 'ARAS analysiert dein Unternehmen.' : 'Starte eine neue Analyse.'} live={isRun} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <BtnP onClick={() => setShowModal(true)}>Neue Analyse starten</BtnP>
            <BtnS onClick={() => setShowAddSrc(true)}>Quelle hinzufügen</BtnS>
          </div>
        </motion.div>

        <AnimatePresence>{isRun && <ABanner running={isRun} phase={aPhase || 1} total={PHASES.length} />}</AnimatePresence>
        <AnimatePresence>{topErr && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-3.5 flex items-center justify-between backdrop-blur-xl"><span className="text-[13px] text-red-300">{topErr}</span><TL onClick={() => setTopErr('')}>Schließen</TL></motion.div>}</AnimatePresence>

        {/* GRID 7/5 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-7 space-y-6">
            {/* Account */}
            <SC title="Account & Zugriff" editing={editSec === 'account'} onToggleEdit={() => startEd('account')} onSave={saveProf} onCancel={() => setEditSec(null)} saving={profM.isPending}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <FR label="Username" value={user?.username || ''} editing={editSec === 'account'} editValue={pForm.username} onChange={v => setPForm(p => ({ ...p, username: v }))} placeholder="Username" error={fErr.username} />
                <FR label="E-Mail" value={(user as any)?.email || ''} editing={editSec === 'account'} editValue={pForm.email} onChange={v => setPForm(p => ({ ...p, email: v }))} placeholder="email@beispiel.de" error={fErr.email} />
                <FR label="Vorname" value={(user as any)?.firstName || ''} editing={editSec === 'account'} editValue={pForm.firstName} onChange={v => setPForm(p => ({ ...p, firstName: v }))} placeholder="Vorname" />
                <FR label="Nachname" value={(user as any)?.lastName || ''} editing={editSec === 'account'} editValue={pForm.lastName} onChange={v => setPForm(p => ({ ...p, lastName: v }))} placeholder="Nachname" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t" style={{ borderColor: C.stroke }}>
                <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: C.text3 }}>Plan</div><div className="text-[14px] font-bold" style={{ color: C.orange }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</div></div>
                <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: C.text3 }}>Erstellt</div><div className="text-[13px]" style={{ color: C.text2 }}>{fmtD((user as any)?.createdAt)}</div></div>
              </div>
            </SC>
            {/* Company */}
            <SC title="Unternehmensprofil" editing={editSec === 'company'} onToggleEdit={() => startEd('company')} onSave={saveCo} onCancel={() => setEditSec(null)} saving={profM.isPending}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <FR label="Firmenname" value={ctx?.company || ''} editing={editSec === 'company'} editValue={pForm.company} onChange={v => setPForm(p => ({ ...p, company: v }))} placeholder="ARAS AI GmbH" />
                <FR label="Website" value={ctx?.website || ''} editing={editSec === 'company'} editValue={pForm.website} onChange={v => setPForm(p => ({ ...p, website: v }))} placeholder="https://aras-ai.com" />
                <FR label="Branche" value={ctx?.industry || ''} editing={editSec === 'company'} editValue={pForm.industry} onChange={v => setPForm(p => ({ ...p, industry: v }))} placeholder="Technology / SaaS" />
                <FR label="Position" value={ctx?.jobRole || ''} editing={editSec === 'company'} editValue={pForm.jobRole} onChange={v => setPForm(p => ({ ...p, jobRole: v }))} placeholder="CEO, Sales, ..." />
                <FR label="Telefon" value={ctx?.phone || ''} editing={editSec === 'company'} editValue={pForm.phone} onChange={v => setPForm(p => ({ ...p, phone: v }))} placeholder="+43 ..." />
              </div>
            </SC>
            {/* Business Intelligence */}
            <SC title="Business Intelligence" editing={editSec === 'business'} onToggleEdit={() => startEd('business')} onSave={saveAi} onCancel={() => setEditSec(null)} saving={aiM.isPending}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <FR label="Beschreibung" value={trim(ai.companyDescription)} editing={editSec === 'business'} editValue={aiForm.companyDescription} onChange={v => setAiForm(p => ({ ...p, companyDescription: v }))} placeholder="Was macht dein Unternehmen?" multi />
                <FR label="Zielgruppe" value={trim(ai.targetAudience)} editing={editSec === 'business'} editValue={aiForm.targetAudience} onChange={v => setAiForm(p => ({ ...p, targetAudience: v }))} placeholder="Wer sind eure Kunden?" multi />
                <FR label="Produkte" value={arr(ai.products).join(', ') || arr(ai.services).join(', ')} editing={editSec === 'business'} editValue={(aiForm.products || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, products: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="Produkt A, B" />
                <FR label="USPs" value={arr(ai.uniqueSellingPoints).join(' · ')} editing={editSec === 'business'} editValue={(aiForm.uniqueSellingPoints || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, uniqueSellingPoints: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="USP 1, 2" />
                <FR label="Wertversprechen" value={trim(ai.valueProp)} editing={editSec === 'business'} editValue={aiForm.valueProp} onChange={v => setAiForm(p => ({ ...p, valueProp: v }))} placeholder="Hauptversprechen" />
                <FR label="Wettbewerber" value={arr(ai.competitors).join(', ')} editing={editSec === 'business'} editValue={(aiForm.competitors || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, competitors: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="Firma X, Y" />
                <FR label="Brand Voice" value={trim(ai.brandVoice)} editing={editSec === 'business'} editValue={aiForm.brandVoice} onChange={v => setAiForm(p => ({ ...p, brandVoice: v }))} placeholder="Professionell, freundlich..." multi />
                <FR label="Keywords" value={arr(ai.effectiveKeywords).join(', ')} editing={editSec === 'business'} editValue={(aiForm.effectiveKeywords || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, effectiveKeywords: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="KW 1, 2" />
              </div>
            </SC>
            {/* Deep */}
            <SC title="Tiefe Analyse" editing={editSec === 'deep'} onToggleEdit={() => startEd('deep')} onSave={saveAi} onCancel={() => setEditSec(null)} saving={aiM.isPending}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                <FR label="Gründungsjahr" value={String(ai.foundedYear || '')} editing={editSec === 'deep'} editValue={String(aiForm.foundedYear || '')} onChange={v => setAiForm(p => ({ ...p, foundedYear: v }))} placeholder="2024" />
                <FR label="CEO" value={trim(ai.ceoName)} editing={editSec === 'deep'} editValue={aiForm.ceoName || ''} onChange={v => setAiForm(p => ({ ...p, ceoName: v }))} placeholder="Name" />
                <FR label="Mitarbeiter" value={String(ai.employeeCount || '')} editing={editSec === 'deep'} editValue={String(aiForm.employeeCount || '')} onChange={v => setAiForm(p => ({ ...p, employeeCount: v }))} placeholder="50" />
                <FR label="Umsatz" value={trim(ai.revenue)} editing={editSec === 'deep'} editValue={aiForm.revenue || ''} onChange={v => setAiForm(p => ({ ...p, revenue: v }))} placeholder="~5M" />
                <FR label="Funding" value={trim(ai.fundingInfo)} editing={editSec === 'deep'} editValue={aiForm.fundingInfo || ''} onChange={v => setAiForm(p => ({ ...p, fundingInfo: v }))} placeholder="Series A" />
                <FR label="Herausforderungen" value={arr(ai.currentChallenges).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.currentChallenges || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, currentChallenges: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                <FR label="Chancen" value={arr(ai.opportunities).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.opportunities || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, opportunities: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                <FR label="Sales Triggers" value={arr(ai.salesTriggers).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.salesTriggers || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, salesTriggers: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                <FR label="Anrufzeiten" value={trim(ai.bestCallTimes)} editing={editSec === 'deep'} editValue={aiForm.bestCallTimes || ''} onChange={v => setAiForm(p => ({ ...p, bestCallTimes: v }))} placeholder="Di-Do 10-12" />
              </div>
              <div className="mt-5 pt-5 border-t" style={{ borderColor: C.stroke }}>
                <div className="text-[11px] font-bold tracking-[0.10em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.20)' }}>Persönliche Intelligenz</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                  <FR label="Persönlichkeit" value={trim(ai.personalityType)} editing={editSec === 'deep'} editValue={aiForm.personalityType || ''} onChange={v => setAiForm(p => ({ ...p, personalityType: v }))} placeholder="Analytisch..." />
                  <FR label="Kommunikation" value={trim(ai.communicationTone)} editing={editSec === 'deep'} editValue={aiForm.communicationTone || ''} onChange={v => setAiForm(p => ({ ...p, communicationTone: v }))} placeholder="Professional..." />
                  <FR label="Pain Points" value={arr(ai.painPoints).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.painPoints || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, painPoints: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                  <FR label="Ziele" value={arr(ai.goals).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.goals || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, goals: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                  <FR label="Tech-Level" value={trim(ai.technicalLevel)} editing={editSec === 'deep'} editValue={aiForm.technicalLevel || ''} onChange={v => setAiForm(p => ({ ...p, technicalLevel: v }))} placeholder="Hoch/Mittel" />
                  <FR label="Erfolgsmetriken" value={arr(ai.successMetrics).join(', ')} editing={editSec === 'deep'} editValue={(aiForm.successMetrics || []).join(', ')} onChange={v => setAiForm(p => ({ ...p, successMetrics: v.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="..." />
                </div>
              </div>
              {(ai.customSystemPrompt || editSec === 'deep') && <div className="mt-5 pt-5 border-t" style={{ borderColor: C.stroke }}><FR label="Custom System Prompt" value={trim(ai.customSystemPrompt)} editing={editSec === 'deep'} editValue={aiForm.customSystemPrompt || ''} onChange={v => setAiForm(p => ({ ...p, customSystemPrompt: v }))} placeholder="Eigene KI-Anweisungen..." multi /></div>}
            </SC>
            {/* Sources */}
            <SC title={`Datenquellen${ds.length ? ` (${ds.length})` : ''}`}>
              {dsL ? <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} h={64} className="rounded-2xl" />)}</div>
              : ds.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-[15px] font-semibold mb-2" style={{ color: C.text1 }}>{COPY.emptyTitle}</div>
                  <div className="text-[13px] mb-5" style={{ color: C.text3 }}>{COPY.emptySub}</div>
                  <div className="flex flex-wrap justify-center gap-3"><BtnP onClick={() => setShowModal(true)}>Analyse starten</BtnP><BtnS onClick={() => setShowAddSrc(true)}>Quelle hinzufügen</BtnS></div>
                </div>
              ) : <div className="space-y-2.5">{ds.map(s => <SRow key={s.id} src={s} expanded={expSrc.has(s.id)} onToggle={() => setExpSrc(p => { const n = new Set(p); expSrc.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })} onDel={() => delM.mutate(s.id)} />)}</div>}
            </SC>
            {/* Context Preview */}
            <SC title="KI-Kontext Vorschau">
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: C.text3 }}>Das sieht die Telefon-KI bei jedem Anruf</div>
              {dig?.digest ? (
                <div className="relative">
                  <pre className="p-5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto font-mono" style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.stroke}`, color: C.text2 }}>{dig.digest}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(dig.digest); toast({ title: 'Kopiert!' }); }} className="absolute top-4 right-4 text-[11px] tracking-[0.08em] uppercase font-semibold text-white/[0.35] hover:text-[#FE9100] transition-colors">Kopieren</button>
                </div>
              ) : <div className="text-[13px] py-6 italic" style={{ color: C.text3 }}>Kein Kontext. Starte eine Analyse.</div>}
              {dig?.sourceCount !== undefined && <div className="mt-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{dig.sourceCount} Quellen · {dig.digest?.length || 0} Zeichen</div>}
            </SC>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5 space-y-6">
            <ACon running={isRun} ps={aPS} logs={aLogs} eStatus={eStatus} conf={ai.enrichmentMeta?.confidence} att={ai.enrichmentMeta?.attempts} lastUp={ai.lastUpdated || ctx?.lastEnrichmentDate} errCode={ai.enrichmentErrorCode} />
            <SC title="Nutzung & Plan">
              <div className="space-y-4">
                <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: C.text3 }}>Plan</div><div className="text-[15px] font-bold" style={{ color: C.orange }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</div></div>
                {sub?.usage?.aiMessages !== undefined && <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: C.text3 }}>KI-Nachrichten</div><div className="text-[13px]" style={{ color: C.text2 }}>{sub.usage.aiMessages.used} / {sub.usage.aiMessages.limit}</div></div>}
                {sub?.usage?.voiceCalls !== undefined && <div><div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: C.text3 }}>Voice Calls</div><div className="text-[13px]" style={{ color: C.text2 }}>{sub.usage.voiceCalls.used} / {sub.usage.voiceCalls.limit}</div></div>}
              </div>
            </SC>
            {ai._userFormData && <SC title="Letzte Analyse-Eingaben"><div className="space-y-0">{Object.entries(ai._userFormData as Record<string, any>).filter(([k]) => k !== 'submittedAt').map(([k, v]) => <FR key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={String(v || '')} editing={false} />)}</div>{ai._userFormData.submittedAt && <div className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.18)' }}>Eingereicht: {fmtA(ai._userFormData.submittedAt)}</div>}</SC>}
          </div>
        </div>

        <AModal open={showModal} onClose={() => setShowModal(false)} ctx={ctx} ai={ai} onStart={startPhases} onDone={stopPhases} />
        <AddDlg open={showAddSrc} onClose={() => setShowAddSrc(false)} onAdd={(d: { type: string; title: string; contentText?: string; url?: string }) => addM.mutate(d)} saving={addM.isPending} />
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.6}}`}</style>
    </div>
  );
}

/* ── Analysis Modal (2-step form + operator lines during run) ── */
function AModal({ open, onClose, ctx, ai, onStart, onDone }: {
  open: boolean; onClose: () => void; ctx: ProfileCtx | undefined; ai: any;
  onStart: () => void; onDone: (ok: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [st, setSt] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [adv, setAdv] = useState(false);
  const [rp, setRp] = useState(0);
  const rt = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        companyName: ctx?.company || '', website: ctx?.website || '', industry: ctx?.industry || '',
        region: ai?._userFormData?.region || '', offer: trim(ai?.companyDescription) || '',
        targetAudience: trim(ai?.targetAudience) || '', usp: arr(ai?.uniqueSellingPoints).join(', ') || '',
        pricing: ai?._userFormData?.pricing || '', objections: ai?._userFormData?.objections || '',
        faq: ai?._userFormData?.faq || '', compliance: ai?._userFormData?.compliance || '',
        tone: trim(ai?.brandVoice) || '', competitors: arr(ai?.competitors).join(', ') || '',
        callGoal: ai?._userFormData?.callGoal || '', doNotSay: ai?._userFormData?.doNotSay || '',
      });
      setSt('idle'); setErr(''); setAdv(false); setRp(0);
    }
    return () => { if (rt.current) clearInterval(rt.current); };
  }, [open, ctx, ai]);

  const submit = async () => {
    if (!form.companyName?.trim()) { setErr('Firmenname ist erforderlich.'); return; }
    setSt('running'); setErr(''); setRp(0); onStart();
    let p = 0;
    rt.current = setInterval(() => { p++; setRp(p); if (p >= PHASES.length && rt.current) clearInterval(rt.current); }, 5000);
    try {
      const r = await fetch('/api/user/business-analysis', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || 'Analyse fehlgeschlagen');
      if (rt.current) clearInterval(rt.current); setRp(PHASES.length); setSt('done'); onDone(true);
      toast({ title: 'Analyse abgeschlossen', description: d.message });
      setTimeout(() => { qc.invalidateQueries({ queryKey: ['/api/user/profile-context'] }); qc.invalidateQueries({ queryKey: ['/api/user/knowledge/digest'] }); qc.invalidateQueries({ queryKey: ['/api/user/data-sources'] }); qc.invalidateQueries({ queryKey: ['/api/auth/me'] }); onClose(); }, 2000);
    } catch (e: any) { if (rt.current) clearInterval(rt.current); setSt('error'); setErr(e.message || 'Fehler'); onDone(false); }
  };

  const reqFields: { key: string; label: string; multi?: boolean; req?: boolean }[] = [
    { key: 'companyName', label: 'Firmenname', req: true },
    { key: 'website', label: 'Website' },
    { key: 'industry', label: 'Branche' },
    { key: 'region', label: 'Region / Markt' },
    { key: 'offer', label: 'Angebot / Beschreibung', multi: true },
  ];
  const advFields: { key: string; label: string; multi?: boolean }[] = [
    { key: 'targetAudience', label: 'Zielgruppe', multi: true },
    { key: 'usp', label: 'USPs (kommagetrennt)' },
    { key: 'pricing', label: 'Preise / Pakete', multi: true },
    { key: 'tone', label: 'Tonalität / Sprache' },
    { key: 'competitors', label: 'Wettbewerber (kommagetrennt)' },
    { key: 'callGoal', label: 'Anruf-Ziel', multi: true },
    { key: 'objections', label: 'Häufige Einwände', multi: true },
    { key: 'faq', label: 'FAQ', multi: true },
    { key: 'compliance', label: 'Compliance / No-Gos', multi: true },
    { key: 'doNotSay', label: 'Nicht sagen (Do-Not-Say)', multi: true },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && st !== 'running') onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-[rgba(233,215,196,0.10)]" style={{ borderRadius: 28, background: '#0a0a0f' }}>
        <DialogHeader>
          <DialogTitle className="text-lg" style={{ ...orb, color: C.gold }}>Business neu analysieren</DialogTitle>
          <DialogDescription className="text-[13px]" style={{ color: C.text2 }}>
            Fülle die Felder aus. ARAS analysiert dein Business und aktualisiert die Wissensdatenbank.
          </DialogDescription>
        </DialogHeader>

        {st === 'running' ? (
          <div className="py-8">
            <div className="text-center mb-8">
              <div className="text-[13px] font-bold tracking-[0.04em] uppercase mb-2" style={{ ...orb, color: C.gold, fontSize: 13 }}>{COPY.overlayTitle}</div>
              <div className="text-[12px]" style={{ color: C.text3 }}>{COPY.overlayDuration}</div>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              {PHASES.map(({ key, label }, i) => {
                const s = i < rp ? 'done' : i === rp ? 'running' : 'queued';
                return (
                  <motion.div key={key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: s === 'running' ? 'rgba(254,145,0,0.06)' : 'transparent', border: s === 'running' ? '1px solid rgba(254,145,0,0.15)' : '1px solid transparent' }}>
                    <span className="text-[13px] font-medium tracking-wide" style={{ color: s === 'done' ? C.text1 : s === 'running' ? C.gold : C.text3 }}>{label}</span>
                    <span className="text-[10px] tracking-[0.16em] uppercase font-bold" style={{ color: s === 'done' ? 'rgba(74,222,128,0.80)' : s === 'running' ? C.orange : 'rgba(255,255,255,0.20)' }}>
                      {s === 'done' ? 'DONE' : s === 'running' ? 'RUNNING' : 'QUEUED'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-6 h-[2px] rounded-full overflow-hidden max-w-sm mx-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${C.gold},${C.orange},${C.goldDark})` }}
                animate={{ width: `${((rp + 1) / PHASES.length) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <div className="text-center mt-6">
              <BtnS onClick={onClose}>{COPY.overlayDismiss}</BtnS>
            </div>
          </div>
        ) : st === 'done' ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-green-500/30 mx-auto mb-4 flex items-center justify-center"><span className="text-green-400 text-xl">✓</span></div>
            <div className="text-[14px] font-semibold mb-1" style={{ ...orb, color: C.gold }}>Analyse abgeschlossen</div>
            <div className="text-[13px]" style={{ color: C.text3 }}>Wissensdatenbank wird aktualisiert…</div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {err && <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{err}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reqFields.map(f => (
                <div key={f.key} className={f.multi ? 'sm:col-span-2' : ''}>
                  <label className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5 block" style={{ color: C.text3 }}>
                    {f.label}{f.req && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {f.multi ? <Textarea value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl min-h-[70px] focus:border-[#FE9100]/40" />
                    : <Input value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl h-10 focus:border-[#FE9100]/40" />}
                </div>
              ))}
            </div>

            {/* Advanced toggle */}
            <button onClick={() => setAdv(!adv)} className="text-[11px] tracking-[0.08em] uppercase font-semibold transition-colors" style={{ color: adv ? C.orange : C.text3 }}>
              {adv ? 'Erweiterte Felder ausblenden' : 'Erweiterte Felder anzeigen'}
            </button>

            <AnimatePresence>
              {adv && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {advFields.map(f => (
                      <div key={f.key} className={f.multi ? 'sm:col-span-2' : ''}>
                        <label className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5 block" style={{ color: C.text3 }}>{f.label}</label>
                        {f.multi ? <Textarea value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl min-h-[70px] focus:border-[#FE9100]/40" />
                          : <Input value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl h-10 focus:border-[#FE9100]/40" />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-[11px] leading-relaxed pt-1" style={{ color: C.text3 }}>{COPY.formNote}</div>

            <div className="flex justify-end gap-3 pt-2">
              <BtnS onClick={onClose}>Abbrechen</BtnS>
              <BtnP onClick={submit}>Analyse starten</BtnP>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Add Source Dialog ── */
function AddDlg({ open, onClose, onAdd, saving }: {
  open: boolean; onClose: () => void;
  onAdd: (d: { type: string; title: string; contentText?: string; url?: string }) => void;
  saving: boolean;
}) {
  const [tp, setTp] = useState<'text' | 'url'>('text');
  const [tl, setTl] = useState('');
  const [ct, setCt] = useState('');
  const [ur, setUr] = useState('');
  useEffect(() => { if (open) { setTp('text'); setTl(''); setCt(''); setUr(''); } }, [open]);
  const go = () => { if (!tl.trim()) return; tp === 'text' ? onAdd({ type: 'text', title: tl.trim(), contentText: ct.trim() }) : onAdd({ type: 'url', title: tl.trim(), url: ur.trim() }); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg border-[rgba(233,215,196,0.10)]" style={{ borderRadius: 28, background: '#0a0a0f' }}>
        <DialogHeader>
          <DialogTitle className="text-lg" style={{ ...orb, color: C.gold }}>Quelle hinzufügen</DialogTitle>
          <DialogDescription className="text-[13px]" style={{ color: C.text2 }}>Text oder URL als Wissensquelle hinzufügen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            {(['text', 'url'] as const).map(t => (
              <button key={t} onClick={() => setTp(t)} className="px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase transition-all"
                style={{ border: `1px solid ${tp === t ? C.orange + '40' : C.stroke}`, color: tp === t ? C.orange : C.text3, background: tp === t ? C.orange + '10' : 'transparent' }}>
                {t === 'text' ? 'Text' : 'URL'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5 block" style={{ color: C.text3 }}>Titel</label>
            <Input value={tl} onChange={e => setTl(e.target.value)} placeholder="Titel der Quelle" className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl h-10 focus:border-[#FE9100]/40" />
          </div>
          {tp === 'text' ? (
            <div><label className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5 block" style={{ color: C.text3 }}>Inhalt</label>
              <Textarea value={ct} onChange={e => setCt(e.target.value)} placeholder="Text hier einfügen..." className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl min-h-[120px] focus:border-[#FE9100]/40" /></div>
          ) : (
            <div><label className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5 block" style={{ color: C.text3 }}>URL</label>
              <Input value={ur} onChange={e => setUr(e.target.value)} placeholder="https://..." className="bg-white/[0.03] border-white/[0.10] text-white/90 text-sm rounded-2xl h-10 focus:border-[#FE9100]/40" /></div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <BtnS onClick={onClose}>Abbrechen</BtnS>
            <BtnP onClick={go} disabled={saving || !tl.trim()}>{saving ? 'Wird hinzugefügt…' : 'Hinzufügen'}</BtnP>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Leads() { return <EB><LeadsContent /></EB>; }
