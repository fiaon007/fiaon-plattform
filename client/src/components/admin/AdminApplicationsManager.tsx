import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AdminAppDetail } from "./AdminAppDetail";
import { AdminAppSubComponents } from "./AdminAppSubComponents";

const { Th, StatusBadge, KycRow, Field } = AdminAppSubComponents;

// ═══════════════════════════════════════════════════════
// STATUS LOGIC
// ═══════════════════════════════════════════════════════
export const getPaymentStatusKey = (app: any): 'paid' | 'pending' | 'cancelled' => {
  const raw = String(app?.payment_status ?? app?.paymentStatus ?? '').toLowerCase().trim();
  if (raw === 'paid' || raw === 'succeeded') return 'paid';
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (app?.stripe_subscription_id && raw === '') return 'paid';
  return 'pending';
};

// EA: rohes payment_status auf sichtbare Bestell-Status-Gruppen abbilden —
// bewusst getrennt von getPaymentStatusKey (das superseded auf „pending" kollabiert).
export const getOrderStatusGroup = (app: any): 'pending_payment' | 'claimed_paid' | 'paid' | 'superseded' | 'cancelled' | 'other' => {
  const raw = String(app?.payment_status ?? '').toLowerCase().trim();
  if (raw === 'paid' || raw === 'succeeded') return 'paid';
  if (raw === 'claimed_paid') return 'claimed_paid';
  if (raw === 'pending_payment') return 'pending_payment';
  if (raw === 'superseded') return 'superseded';
  if (raw === 'cancelled' || raw === 'canceled' || raw === 'refunded') return 'cancelled';
  return 'other';
};

export const ORDER_STATUS_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'pending_payment', label: 'Offen' },
  { key: 'claimed_paid', label: 'Angekündigt' },
  { key: 'paid', label: 'Bezahlt' },
  { key: 'superseded', label: 'Geschlossen/Dublette' },
  { key: 'cancelled', label: 'Storniert' },
];

export const getAppStatusKey = (app: any): 'lead' | 'in_progress' | 'kyc_missing' | 'ready_for_review' | 'completed' | 'cancelled' => {
  const raw = String(app?.status ?? '').toLowerCase().trim();
  const hasBank = !!(app?.has_bank_statement_pdf ?? app?.bank_statement_pdf);
  const hasId = !!(app?.has_id_card_pdf ?? app?.id_card_pdf);
  const allKyc = hasBank && hasId;
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (raw === 'completed' || raw === 'payment_completed') return allKyc ? 'completed' : 'kyc_missing';
  if (raw === 'documents_submitted') return allKyc ? 'ready_for_review' : 'kyc_missing';
  if (raw === 'in_progress' || raw === 'started') return 'in_progress';
  if (!raw) return 'lead';
  return 'in_progress';
};

export const PAYMENT_META: Record<string, { label: string; cls: string; dot: string }> = {
  paid:      { label: 'Bezahlt',    cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  pending:   { label: 'Ausstehend', cls: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  cancelled: { label: 'Storniert',  cls: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-300' },
};

export const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  lead:              { label: 'Lead',            cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  in_progress:       { label: 'In Bearbeitung',  cls: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500' },
  kyc_missing:       { label: 'KYC fehlt',       cls: 'bg-rose-50 text-rose-600',    dot: 'bg-rose-500' },
  ready_for_review:  { label: 'Prüfbereit',      cls: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500' },
  completed:         { label: 'Abgeschlossen',   cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled:         { label: 'Storniert',       cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

export const getFullName = (app: any) => {
  const parts = [app?.first_name, app?.last_name].filter(Boolean).join(' ').trim();
  return parts || app?.company_name || app?.contact_name || app?.email || '—';
};

export const formatDate = (value: any) => {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; }
};

export const formatDateTime = (value: any) => {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
};

export const formatCurrency = (value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
};

interface DuplicateGroup { email: string; count: number; refs: string[]; }
type SortField = 'name' | 'email' | 'status' | 'payment' | 'package' | 'date' | 'ref';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

export default function AdminApplicationsManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  // EA: expliziter Bestell-Status (rohes payment_status) — macht Bezahlt/
  // Geschlossen-Dublette/Storniert eindeutig sichtbar (kein Kollaps auf „Ausstehend").
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [schufaFilter, setSchufaFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [mergePrimary, setMergePrimary] = useState<string>('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchApplications = useCallback(async () => {
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/fiaon/admin/applications', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok !== false) {
        setApplications(Array.isArray(json.data) ? json.data : []);
        setDuplicateGroups(json.duplicateGroups || []);
      } else { setError(`Backend-Fehler (${res.status})`); }
    } catch (err: any) { setError(`Netzwerkfehler: ${err?.message || 'Unbekannt'}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape' && selectedApp) setSelectedApp(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedApp]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = [...applications];
    if (q) filtered = filtered.filter(app => [app.first_name, app.last_name, app.email, app.ref, app.company_name, app.contact_name, app.phone, app.iban].filter(Boolean).join(' ').toLowerCase().includes(q));
    if (statusFilter !== 'all') filtered = filtered.filter(app => getAppStatusKey(app) === statusFilter);
    if (paymentFilter !== 'all') filtered = filtered.filter(app => getPaymentStatusKey(app) === paymentFilter);
    if (schufaFilter === 'uploaded') filtered = filtered.filter(a => !!(a.has_schufa_pdf ?? a.schufa_pdf));
    else if (schufaFilter === 'missing') filtered = filtered.filter(a => !(a.has_schufa_pdf ?? a.schufa_pdf));
    else if (schufaFilter === 'approved') filtered = filtered.filter(a => a.schufa_status === 'approved');
    if (orderStatusFilter !== 'all') filtered = filtered.filter(a => getOrderStatusGroup(a) === orderStatusFilter);
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = getFullName(a).localeCompare(getFullName(b), 'de'); break;
        case 'email': cmp = (a.email || '').localeCompare(b.email || ''); break;
        case 'status': cmp = getAppStatusKey(a).localeCompare(getAppStatusKey(b)); break;
        case 'payment': cmp = getPaymentStatusKey(a).localeCompare(getPaymentStatusKey(b)); break;
        case 'package': cmp = (a.pack_name || '').localeCompare(b.pack_name || ''); break;
        case 'ref': cmp = (a.ref || '').localeCompare(b.ref || ''); break;
        default: { const tA = new Date(a.updated_at || a.created_at || 0).getTime(); const tB = new Date(b.updated_at || b.created_at || 0).getTime(); cmp = tA - tB; }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [applications, searchQuery, statusFilter, paymentFilter, schufaFilter, orderStatusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const paginatedApps = useMemo(() => { const s = (currentPage - 1) * ITEMS_PER_PAGE; return filteredAndSorted.slice(s, s + ITEMS_PER_PAGE); }, [filteredAndSorted, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, paymentFilter, schufaFilter, orderStatusFilter]);

  const stats = useMemo(() => ({
    total: applications.length, paid: applications.filter(a => getPaymentStatusKey(a) === 'paid').length,
    readyForReview: applications.filter(a => getAppStatusKey(a) === 'ready_for_review').length,
    kycMissing: applications.filter(a => getAppStatusKey(a) === 'kyc_missing').length,
    completed: applications.filter(a => getAppStatusKey(a) === 'completed').length,
    leads: applications.filter(a => getAppStatusKey(a) === 'lead').length,
    duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0),
  }), [applications, duplicateGroups]);

  const [batchMode, setBatchMode] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchMerged, setBatchMerged] = useState(0);

  const startBatchMode = () => {
    setBatchMode(true);
    setBatchIndex(0);
    setBatchMerged(0);
    if (duplicateGroups.length > 0) {
      setMergeGroup(duplicateGroups[0]);
      setMergePrimary(duplicateGroups[0].refs[0]);
      setMergeSuccess(null);
    }
  };

  const advanceBatch = () => {
    const nextIdx = batchIndex + 1;
    if (nextIdx < duplicateGroups.length) {
      setBatchIndex(nextIdx);
      setMergeGroup(duplicateGroups[nextIdx]);
      setMergePrimary(duplicateGroups[nextIdx].refs[0]);
      setMergeSuccess(null);
    } else {
      // All done
      setBatchMode(false);
      setMergeGroup(null);
      setMergeSuccess(null);
      fetchApplications();
    }
  };

  const skipBatch = () => {
    advanceBatch();
  };

  const executeMerge = async () => {
    if (!mergeGroup || !mergePrimary) return;
    setMergeLoading(true); setMergeSuccess(null);
    try {
      const dupRefs = mergeGroup.refs.filter(r => r !== mergePrimary);
      const res = await fetch('/api/fiaon/admin/applications/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ primaryRef: mergePrimary, duplicateRefs: dupRefs, reviewed: true }) });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBatchMerged(prev => prev + 1);
        if (batchMode) {
          setMergeSuccess(`Zusammengeführt! Weiter…`);
          setTimeout(() => advanceBatch(), 1200);
        } else {
          setMergeSuccess(`${dupRefs.length} Duplikat(e) zusammengeführt`);
          setTimeout(() => { setMergeGroup(null); setMergeSuccess(null); fetchApplications(); }, 2000);
        }
      } else { setMergeSuccess(`Fehler: ${json.error || 'Unbekannt'}`); }
    } catch (err: any) { setMergeSuccess(`Fehler: ${err?.message}`); }
    setMergeLoading(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'date' ? 'desc' : 'asc'); }
  };

  // ─── DETAIL VIEW ───
  if (selectedApp) {
    return <AdminAppDetail app={selectedApp} setApp={setSelectedApp} applications={applications} setApplications={setApplications} />;
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Gesamt', value: stats.total, color: 'bg-slate-900', onClick: () => { setStatusFilter('all'); setPaymentFilter('all'); } },
          { label: 'Bezahlt', value: stats.paid, color: 'bg-emerald-600', onClick: () => { setPaymentFilter('paid'); setStatusFilter('all'); } },
          { label: 'Prüfbereit', value: stats.readyForReview, color: 'bg-amber-500', onClick: () => { setStatusFilter('ready_for_review'); setPaymentFilter('all'); } },
          { label: 'KYC fehlt', value: stats.kycMissing, color: 'bg-rose-500', onClick: () => { setStatusFilter('kyc_missing'); setPaymentFilter('all'); } },
          { label: 'Abgeschlossen', value: stats.completed, color: 'bg-emerald-600', onClick: () => { setStatusFilter('completed'); setPaymentFilter('all'); } },
          { label: 'Leads', value: stats.leads, color: 'bg-slate-500', onClick: () => { setStatusFilter('lead'); setPaymentFilter('all'); } },
          { label: 'Duplikate', value: stats.duplicateCount, color: stats.duplicateCount > 0 ? 'bg-rose-600' : 'bg-slate-400', onClick: () => stats.duplicateCount > 0 && setShowDuplicates(true) },
        ].map(s => (
          <button key={s.label} onClick={s.onClick} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left hover:-translate-y-0.5">
            <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}><span className="text-white text-[10px] font-bold">{s.value}</span></div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{s.value}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Duplicate Banner */}
      {duplicateGroups.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <p className="text-[14px] font-bold text-rose-800">{duplicateGroups.length} Duplikat-Gruppe{duplicateGroups.length > 1 ? 'n' : ''} erkannt</p>
              <p className="text-[12px] text-rose-600">{stats.duplicateCount} überflüssige Einträge</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={startBatchMode} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">Alle abarbeiten</button>
            <button onClick={() => setShowDuplicates(!showDuplicates)} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">{showDuplicates ? 'Ausblenden' : 'Details'}</button>
          </div>
        </div>
      )}

      {/* Duplicate List */}
      {showDuplicates && duplicateGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-[14px] font-bold text-slate-900">Duplikat-Gruppen</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">Wähle eine Gruppe — Haupteintrag bestimmen, dann zusammenführen.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {duplicateGroups.map(g => (
              <div key={g.email} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">{g.email}</p>
                  <p className="text-[11px] text-slate-500">{g.count} Einträge: {g.refs.join(', ')}</p>
                </div>
                <button onClick={() => { setMergeGroup(g); setMergePrimary(g.refs[0]); setMergeSuccess(null); }} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors shrink-0">Zusammenführen</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !mergeLoading && !batchMode && setMergeGroup(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">{batchMode ? 'Duplikate abarbeiten' : 'Duplikate zusammenführen'}</h3>
                  <p className="text-[12px] text-slate-500 mt-1">E-Mail: <span className="font-mono font-semibold">{mergeGroup.email}</span></p>
                </div>
                {batchMode && (
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-[20px] font-bold text-slate-900 tabular-nums">{batchIndex + 1}<span className="text-slate-300">/{duplicateGroups.length}</span></p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">{batchMerged} erledigt</p>
                  </div>
                )}
              </div>
              {batchMode && (
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${((batchIndex + 1) / duplicateGroups.length) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] text-slate-700 font-medium">Haupteintrag wählen (wird behalten):</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {mergeGroup.refs.map(ref => {
                  const app = applications.find(a => a.ref === ref);
                  const name = app ? getFullName(app) : ref;
                  const st = app ? STATUS_META[getAppStatusKey(app)] : null;
                  const pay = app ? PAYMENT_META[getPaymentStatusKey(app)] : null;
                  return (
                    <label key={ref} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${mergePrimary === ref ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <input type="radio" name="mergePrimary" value={ref} checked={mergePrimary === ref} onChange={() => setMergePrimary(ref)} className="w-4 h-4 accent-blue-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-slate-500 font-mono">{ref}</p>
                          {app?.pack_name && <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{app.pack_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pay && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`}/>{pay.label}</span>}
                        {st && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
              {!batchMode && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[12px] text-amber-800 font-semibold">Prüfung durch MA erforderlich</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">Duplikate werden unwiderruflich gelöscht.</p>
                </div>
              )}
              {mergeSuccess && <p className={`text-[13px] font-semibold px-3 py-2 rounded-xl ${mergeSuccess.startsWith('Fehler') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{mergeSuccess}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-between">
              <div className="flex gap-2">
                {batchMode && <button onClick={skipBatch} disabled={mergeLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Überspringen</button>}
                <button onClick={() => { setBatchMode(false); setMergeGroup(null); setMergeSuccess(null); if (batchMerged > 0) fetchApplications(); }} disabled={mergeLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">{batchMode ? 'Beenden' : 'Abbrechen'}</button>
              </div>
              <button onClick={executeMerge} disabled={mergeLoading || !mergePrimary} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                {mergeLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Zusammenführen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Alle Kunden & Anträge</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">{filteredAndSorted.length}{filteredAndSorted.length !== applications.length && ` / ${applications.length}`} Einträge{totalPages > 1 && ` · Seite ${currentPage}/${totalPages}`}</p>
            </div>
            <button onClick={fetchApplications} disabled={loading} className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors" title="Neu laden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
          {/* EA: Bestell-Status-Chips — jeder Status erreichbar, nichts unsichtbar */}
          <div className="flex flex-wrap gap-2 mb-3">
            {ORDER_STATUS_CHIPS.map(chip => {
              const active = orderStatusFilter === chip.key;
              const n = chip.key === 'all' ? applications.length : applications.filter(a => getOrderStatusGroup(a) === chip.key).length;
              return (
                <button key={chip.key} onClick={() => setOrderStatusFilter(chip.key)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {chip.label}{chip.key !== 'all' ? ` (${n})` : ''}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, E-Mail, Ref-ID, IBAN… (⌘K)" className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"><option value="all">Alle Status</option><option value="lead">Lead</option><option value="in_progress">In Bearbeitung</option><option value="kyc_missing">KYC fehlt</option><option value="ready_for_review">Prüfbereit</option><option value="completed">Abgeschlossen</option><option value="cancelled">Storniert</option></select>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"><option value="all">Alle Zahlungen</option><option value="paid">Bezahlt</option><option value="pending">Ausstehend</option><option value="cancelled">Storniert</option></select>
            <select value={schufaFilter} onChange={e => setSchufaFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm font-medium text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100"><option value="all">SCHUFA: Alle</option><option value="uploaded">Hochgeladen</option><option value="missing">Fehlt</option><option value="approved">Genehmigt</option></select>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-700 flex-1">{error}</p>
            <button onClick={fetchApplications} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="p-5 space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />)}</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-slate-600">{applications.length === 0 ? 'Keine Anträge vorhanden' : 'Keine Treffer'}</p>
            {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || schufaFilter !== 'all' || orderStatusFilter !== 'all') && <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); setSchufaFilter('all'); setOrderStatusFilter('all'); }} className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Filter zurücksetzen</button>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100">
                  <Th field="ref" label="Ref" sortField={sortField} sortDir={sortDir} toggle={toggleSort} />
                  <Th field="name" label="Name" sortField={sortField} sortDir={sortDir} toggle={toggleSort} />
                  <Th field="email" label="E-Mail" sortField={sortField} sortDir={sortDir} toggle={toggleSort} className="hidden lg:table-cell" />
                  <Th field="package" label="Paket" sortField={sortField} sortDir={sortDir} toggle={toggleSort} />
                  <Th field="status" label="Status" sortField={sortField} sortDir={sortDir} toggle={toggleSort} />
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden md:table-cell">SCHUFA</th>
                  <Th field="payment" label="Zahlung" sortField={sortField} sortDir={sortDir} toggle={toggleSort} />
                  <Th field="date" label="Datum" sortField={sortField} sortDir={sortDir} toggle={toggleSort} className="text-right" />
                </tr></thead>
                <tbody>
                  {paginatedApps.map(app => {
                    const pay = PAYMENT_META[getPaymentStatusKey(app)];
                    const st = STATUS_META[getAppStatusKey(app)];
                    const fullName = getFullName(app);
                    const isDup = duplicateGroups.some(g => g.refs.includes(app.ref));
                    return (
                      <tr key={app.id || app.ref} onClick={() => setSelectedApp(app)} className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${isDup ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-3 px-4"><div className="flex items-center gap-1.5">{isDup && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Duplikat" />}<span className="text-[11px] font-mono text-slate-500">{app.ref || '—'}</span></div></td>
                        <td className="py-3 px-4"><div className="flex items-center gap-3 min-w-0"><div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">{(fullName?.[0] || '?').toUpperCase()}</div><div className="min-w-0"><p className="text-[13px] font-semibold text-slate-900 truncate max-w-[200px]">{fullName}</p><p className="text-[11px] text-slate-400 truncate lg:hidden max-w-[180px]">{app.email || '—'}</p></div></div></td>
                        <td className="py-3 px-4 hidden lg:table-cell"><span className="text-[12px] text-slate-600 truncate block max-w-[220px]">{app.email || '—'}</span></td>
                        <td className="py-3 px-4"><span className="text-[12px] font-medium text-slate-700">{app.pack_name || '—'}</span></td>
                        <td className="py-3 px-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
                        <td className="py-3 px-4 hidden md:table-cell">{(() => { const has = !!(app.has_schufa_pdf ?? app.schufa_pdf); const approved = app.schufa_status === 'approved'; if (approved) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>Geprüft</span>; if (has) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Hochgel.</span>; return <span className="text-[11px] text-slate-400">—</span>; })()}</td>
                        <td className="py-3 px-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`} />{pay.label}</span></td>
                        <td className="py-3 px-4 text-right"><span className="text-[12px] text-slate-500 whitespace-nowrap">{formatDate(app.updated_at || app.created_at)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[12px] text-slate-500">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSorted.length)} von {filteredAndSorted.length}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30">«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30">‹</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pg: number; if (totalPages <= 5) pg = i + 1; else if (currentPage <= 3) pg = i + 1; else if (currentPage >= totalPages - 2) pg = totalPages - 4 + i; else pg = currentPage - 2 + i; return <button key={pg} onClick={() => setCurrentPage(pg)} className={`w-8 h-8 rounded-lg text-[12px] font-semibold ${currentPage === pg ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{pg}</button>; })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30">›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30">»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
