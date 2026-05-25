import { useState, useEffect, useMemo } from "react";
import CeoMindOS from "@/components/admin/CeoMindOS";
import LiveRadar from "@/components/admin/LiveRadar";
import KnowledgeBase from "@/components/admin/KnowledgeBase";
import AccountingDashboard from "@/components/admin/AccountingDashboard";
import MinimalistGlassLauncher from "@/components/layout/MinimalistGlassLauncher";

interface AI_Task {
  id: string;
  clientName: string;
  clientPackage: "Starter" | "Pro" | "Ultra" | "High End";
  taskType: "Limit-Erhöhung" | "Schufa-Klärung" | "Strategie-Call" | "System";
  urgencyScore: number; // 0-100 (KI-generiert)
  deadline: string; // ISO Date
  status: "open" | "in_progress" | "waiting_for_client" | "resolved";
  assignedDirectorId: string | null;
  title?: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function AdminDatabasePage() {
  const [greeting, setGreeting] = useState("");
  const [typedText, setTypedText] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [todos, setTodos] = useState<AI_Task[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [appsError, setAppsError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [reuploadBank, setReuploadBank] = useState(false);
  const [reuploadId, setReuploadId] = useState(false);
  const [profileNote, setProfileNote] = useState('');
  const [schufaNote, setSchufaNote] = useState('');
  const [adminSection, setAdminSection] = useState<'overview'|'applications'|'tasks'|'command'|'radar'|'knowledge'|'accounting'|'cancellations'>('overview');

  const [cancellations, setCancellations] = useState<any[]>([]);
  const [cancellationsLoading, setCancellationsLoading] = useState(false);
  const [selectedCancellation, setSelectedCancellation] = useState<any | null>(null);
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationActionLoading, setCancellationActionLoading] = useState(false);
  const [cancellationSuccess, setCancellationSuccess] = useState<string | null>(null);
  const [cancellationFilter, setCancellationFilter] = useState<'all'|'pending'|'confirmed'|'rejected'>('pending');

  const sendReview = async (kycStatus?: string, accountStatus?: string, noteOverride?: string, reuploadBankOverride?: boolean, reuploadIdOverride?: boolean) => {
    if (!selectedApp?.ref) return;
    setReviewLoading(true);
    setReviewSuccess(null);
    try {
      const body: any = {};
      if (kycStatus) body.kycStatus = kycStatus;
      if (accountStatus) body.accountStatus = accountStatus;
      if (noteOverride !== undefined) body.adminNote = noteOverride;
      else if (reviewNote.trim()) body.adminNote = reviewNote.trim();
      if (reuploadBankOverride !== undefined) body.reuploadBankStatement = reuploadBankOverride;
      else if (kycStatus === 'changes_requested') body.reuploadBankStatement = reuploadBank;
      if (reuploadIdOverride !== undefined) body.reuploadIdCard = reuploadIdOverride;
      else if (kycStatus === 'changes_requested') body.reuploadIdCard = reuploadId;
      const res = await fetch(`/api/fiaon/admin/applications/${selectedApp.ref}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSelectedApp({ ...selectedApp, kyc_status: kycStatus ?? selectedApp.kyc_status, account_status: accountStatus ?? selectedApp.account_status, admin_note: body.adminNote ?? selectedApp.admin_note, reupload_bank_statement: body.reuploadBankStatement ?? selectedApp.reupload_bank_statement, reupload_id_card: body.reuploadIdCard ?? selectedApp.reupload_id_card, admin_profile_note: body.adminProfileNote ?? selectedApp.admin_profile_note, profile_changes_requested: body.profileChangesRequested ?? selectedApp.profile_changes_requested });
        setApplications(prev => prev.map(a => a.ref === selectedApp.ref ? { ...a, ...body } : a));
        setReviewSuccess('Gespeichert');
        setTimeout(() => setReviewSuccess(null), 2500);
        if (kycStatus !== 'changes_requested') { setReviewNote(""); setReuploadBank(false); setReuploadId(false); }
      }
    } catch {}
    setReviewLoading(false);
  };

  const sendSchufaAction = async (schufaStatus: string, note?: string) => {
    if (!selectedApp?.ref) return;
    setReviewLoading(true);
    setReviewSuccess(null);
    try {
      const body: any = { schufaStatus };
      if (note !== undefined) body.adminSchufaNote = note;
      const res = await fetch(`/api/fiaon/admin/applications/${selectedApp.ref}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = { ...selectedApp, schufa_status: schufaStatus, admin_schufa_note: note !== undefined ? (note || null) : selectedApp.admin_schufa_note };
        setSelectedApp(updated);
        setApplications(prev => prev.map(a => a.ref === selectedApp.ref ? { ...a, schufa_status: schufaStatus } : a));
        setReviewSuccess('SCHUFA-Status gespeichert');
        setTimeout(() => setReviewSuccess(null), 2500);
        if (note !== undefined) setSchufaNote('');
      }
    } catch {}
    setReviewLoading(false);
  };

  useEffect(() => {
    const hour = new Date().getHours();
    let greetingText = "";
    
    if (hour >= 5 && hour < 12) {
      greetingText = "Guten Morgen";
    } else if (hour >= 12 && hour < 18) {
      greetingText = "Guten Mittag";
    } else {
      greetingText = "Guten Abend";
    }
    
    setGreeting(greetingText);

    // Typing animation
    const fullText = `${greetingText}, Justin!`;
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(typingInterval);
      }
    }, 80);

    return () => clearInterval(typingInterval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchApplications();
  }, []);

  useEffect(() => {
    if (adminSection === 'cancellations') fetchCancellations();
  }, [adminSection]);

  const fetchCancellations = async () => {
    setCancellationsLoading(true);
    try {
      const res = await fetch('/api/fiaon/admin/cancellations', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.ok) setCancellations(data.data ?? []);
    } catch {}
    finally { setCancellationsLoading(false); }
  };

  const handleCancellationAction = async (status: 'confirmed' | 'rejected') => {
    if (!selectedCancellation) return;
    setCancellationActionLoading(true);
    setCancellationSuccess(null);
    try {
      const res = await fetch(`/api/fiaon/admin/cancellations/${selectedCancellation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, adminNote: cancellationNote.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCancellations(prev => prev.map(c => c.id === selectedCancellation.id ? data.data : c));
        setSelectedCancellation(data.data);
        setCancellationNote('');
        setCancellationSuccess(status === 'confirmed' ? 'Kündigung bestätigt' : 'Kündigung abgelehnt');
        setTimeout(() => setCancellationSuccess(null), 3000);
      }
    } catch {}
    finally { setCancellationActionLoading(false); }
  };

  // Normalisiert Response-Shapes: Array, {data:[]}, {ok,data:[]}, {data:{data:[]}}
  const extractApps = (json: any): any[] => {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.data?.data)) return json.data.data;
    if (Array.isArray(json?.rows)) return json.rows;
    return [];
  };

  const fetchApplications = async () => {
    setAppsError(null);
    setLoadingApps(true);

    // 1) Primär: Lean Admin-Endpoint
    try {
      const res = await fetch('/api/fiaon/admin/applications', {
        credentials: 'include',
      });
      const rawText = await res.text();
      let json: any = null;
      try { json = JSON.parse(rawText); } catch { /* non-json */ }

      console.log('[ADMIN-FETCH] /api/fiaon/admin/applications', {
        status: res.status,
        ok: res.ok,
        jsonKeys: json && typeof json === 'object' ? Object.keys(json) : null,
        count: Array.isArray(json) ? json.length : json?.count ?? json?.data?.length,
      });

      if (res.ok && json) {
        const apps = extractApps(json);
        if (apps.length > 0 || (json?.ok !== false)) {
          setApplications(apps);
          setLoadingApps(false);
          return;
        }
      } else {
        console.warn('[ADMIN-FETCH] primary endpoint failed:', res.status, json?.detail || rawText?.slice(0, 200));
      }
    } catch (err) {
      console.error('[ADMIN-FETCH] primary endpoint network error:', err);
    }

    // 2) Fallback: alter Generic-DB-Endpoint
    try {
      const res = await fetch('/api/database/tables/fiaon_applications/data?limit=500', {
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      console.log('[ADMIN-FETCH] fallback /api/database/tables/...', {
        status: res.status,
        ok: res.ok,
        count: Array.isArray(json?.data) ? json.data.length : null,
      });
      if (res.ok && json) {
        setApplications(extractApps(json));
        setLoadingApps(false);
        return;
      }
      setAppsError(`Backend-Fehler (${res.status}): Anträge konnten nicht geladen werden.`);
    } catch (err: any) {
      console.error('[ADMIN-FETCH] fallback network error:', err);
      setAppsError(`Netzwerkfehler: ${err?.message || 'Unbekannt'}`);
    } finally {
      setLoadingApps(false);
    }
  };

  const formatAppDate = (value: any) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  // =====================================================
  // SMART STATUS LOGIC — Source of truth for the UI
  // =====================================================
  // Zahlungsstatus — liest beide Casings (snake_case DB + ggf. camelCase)
  // und behandelt Stripe-Subscription-IDs als "bezahlt"-Hinweis.
  const getPaymentStatusKey = (app: any): 'paid' | 'pending' | 'cancelled' => {
    const raw = String(
      app?.payment_status ?? app?.paymentStatus ?? ''
    ).toLowerCase().trim();
    if (raw === 'paid' || raw === 'succeeded') return 'paid';
    if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
    // Heuristik: wenn Stripe Subscription aktiv ist, ist Zahlung i.d.R. durch
    if (app?.stripe_subscription_id && raw === '') return 'paid';
    return 'pending';
  };

  // Antragsstatus — nie "Abgeschlossen", solange KYC-Dokumente fehlen.
  const getAppStatusKey = (app: any):
    | 'lead'
    | 'in_progress'
    | 'kyc_missing'
    | 'ready_for_review'
    | 'completed'
    | 'cancelled' => {
    const raw = String(app?.status ?? '').toLowerCase().trim();
    const hasBank = !!(app?.has_bank_statement_pdf ?? app?.bank_statement_pdf);
    const hasId = !!(app?.has_id_card_pdf ?? app?.id_card_pdf);
    const allKyc = hasBank && hasId;

    if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';

    if (raw === 'completed' || raw === 'payment_completed') {
      return allKyc ? 'completed' : 'kyc_missing';
    }
    if (raw === 'documents_submitted') {
      return allKyc ? 'ready_for_review' : 'kyc_missing';
    }
    if (raw === 'in_progress' || raw === 'started') return 'in_progress';
    if (!raw) return 'lead';
    return 'in_progress';
  };

  // =====================================================
  // UI-Dictionaries — Monochrom & reduziert
  // =====================================================
  const PAYMENT_META: Record<string, { label: string; cls: string; dot: string }> = {
    paid:      { label: 'Bezahlt',    cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    pending:   { label: 'Ausstehend', cls: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
    cancelled: { label: 'Storniert',  cls: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-300' },
  };

  const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
    lead:              { label: 'Lead',           cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
    in_progress:       { label: 'In Bearbeitung', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
    kyc_missing:       { label: 'KYC fehlt',      cls: 'bg-rose-50 text-rose-600',    dot: 'bg-rose-500' },
    ready_for_review:  { label: 'Prüfbereit',     cls: 'bg-slate-900 text-white',     dot: 'bg-white' },
    completed:         { label: 'Abgeschlossen',  cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    cancelled:         { label: 'Storniert',      cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  };

  const getFullName = (app: any) => {
    const parts = [app?.first_name, app?.last_name].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    return app?.company_name || app?.contact_name || app?.email || '—';
  };

  // =====================================================
  // DATA ENGINE — Sort (newest first) + Search + Filter
  // =====================================================
  const stats = useMemo(() => ({
    total: applications.length,
    paid: applications.filter(a => getPaymentStatusKey(a) === 'paid').length,
    readyForReview: applications.filter(a => getAppStatusKey(a) === 'ready_for_review').length,
    kycMissing: applications.filter(a => getAppStatusKey(a) === 'kyc_missing').length,
    completed: applications.filter(a => getAppStatusKey(a) === 'completed').length,
    schufaUploaded: applications.filter(a => !!(a.has_schufa_pdf ?? a.schufa_pdf)).length,
    schufaApproved: applications.filter(a => a.schufa_status === 'approved').length,
    recent: [...applications].sort((a,b) => new Date(b.updated_at||b.created_at||0).getTime() - new Date(a.updated_at||a.created_at||0).getTime()).slice(0,5),
  }), [applications]);

  const filteredAndSortedApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tsOf = (app: any) => {
      const t = app?.updated_at || app?.created_at;
      const n = t ? new Date(t).getTime() : 0;
      return Number.isNaN(n) ? 0 : n;
    };

    return [...applications]
      .sort((a, b) => tsOf(b) - tsOf(a))
      .filter((app) => {
        if (q) {
          const hay = [
            app.first_name, app.last_name, app.email, app.ref,
            app.company_name, app.contact_name, app.phone, app.iban,
          ].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (statusFilter === 'schufa_uploaded') { if (!(app.has_schufa_pdf ?? app.schufa_pdf)) return false; }
        else if (statusFilter === 'schufa_missing') { if (!!(app.has_schufa_pdf ?? app.schufa_pdf)) return false; }
        else if (statusFilter === 'schufa_approved') { if (app.schufa_status !== 'approved') return false; }
        else if (statusFilter !== 'all' && getAppStatusKey(app) !== statusFilter) return false;
        if (paymentFilter !== 'all' && getPaymentStatusKey(app) !== paymentFilter) return false;
        return true;
      });
  }, [applications, searchQuery, statusFilter, paymentFilter]);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTodoTitle, priority: 'medium' }),
      });

      if (res.ok) {
        const newTodo = await res.json();
        setTodos([newTodo, ...todos]);
        setNewTodoTitle('');
        setShowAddTodo(false);
      }
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const toggleTodoStatus = async (todo: AI_Task) => {
    const newStatus = todo.status === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setTodos(todos.map(t => t.id === todo.id ? { ...t, status: newStatus } : t));
      }
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setTodos(todos.filter(t => t.id !== todoId));
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'waiting_for_client': return 'bg-yellow-500';
      case 'open': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const menuItems = [
    { icon: "home", label: "Dashboard", active: true },
    { icon: "users", label: "Benutzer", active: false },
    { icon: "credit-card", label: "Anträge", active: false },
    { icon: "bar-chart", label: "Statistiken", active: false },
    { icon: "settings", label: "Einstellungen", active: false },
  ];

  const NAV_ITEMS = [
    { id: 'overview'     as const, label: 'Übersicht',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: 'applications' as const, label: 'Anträge',     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, badge: loadingApps ? undefined : applications.length > 0 ? String(applications.length) : undefined },
    { id: 'tasks'        as const, label: 'Aufgaben',    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>, badge: todos.filter(t=>t.status!=='resolved').length > 0 ? String(todos.filter(t=>t.status!=='resolved').length) : undefined },
    { id: 'command'      as const, label: 'Command OS',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> },
    { id: 'radar'        as const, label: 'Live Radar',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: 'knowledge'    as const, label: 'Wissens-DB',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
    { id: 'accounting'   as const, label: 'Buchhaltung', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, badge: 'neu' },
    { id: 'cancellations' as const, label: 'Kündigungen', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, badge: cancellations.filter(c=>c.status==='pending').length > 0 ? String(cancellations.filter(c=>c.status==='pending').length) : undefined },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <MinimalistGlassLauncher />

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className="w-[220px] shrink-0 h-screen sticky top-0 bg-white border-r border-slate-100 flex flex-col z-20 shadow-sm">
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <a href="/" className="flex items-center gap-2.5">
            <span className="text-lg font-bold fiaon-gradient-text-animated tracking-tight">FIAON</span>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Admin</span>
          </a>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setAdminSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${adminSection === item.id ? 'bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,.3)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <span className={`shrink-0 transition-colors ${adminSection === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>{item.icon}</span>
              <span className="text-[13px] font-semibold truncate flex-1">{item.label}</span>
              {item.badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${adminSection === item.id ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-600'}`}>{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-[13px] font-bold text-slate-700 tabular-nums">{currentTime}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">Admin Panel</p>
        </div>
      </aside>

      {/* ═══════════════ MAIN ═══════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-auto">

        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-0.5">{NAV_ITEMS.find(n=>n.id===adminSection)?.label}</p>
            <h1 className="text-lg font-bold text-slate-900 fiaon-gradient-text-animated">{typedText || 'Admin Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {loadingApps ? (
              <div className="w-4 h-4 border-2 border-slate-200 border-t-[#2563eb] rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-slate-500">{applications.length} Anträge</span>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 lg:p-8 space-y-6">

          {/* ══════════ ÜBERSICHT ══════════ */}
          {adminSection === 'overview' && (
            <div className="space-y-6">
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Gesamt', value: stats.total, color: 'bg-slate-900', sub: 'Alle Anträge' },
                  { label: 'Bezahlt', value: stats.paid, color: 'bg-emerald-600', sub: 'Zahlungen eingegangen' },
                  { label: 'Prüfbereit', value: stats.readyForReview, color: 'bg-[#2563eb]', sub: 'Warten auf Review' },
                  { label: 'KYC fehlt', value: stats.kycMissing, color: 'bg-rose-500', sub: 'Dokumente ausstehend' },
                  { label: 'SCHUFA hoch.', value: stats.schufaUploaded, color: 'bg-amber-500', sub: 'Nachweis eingereicht' },
                  { label: 'SCHUFA ✓', value: stats.schufaApproved, color: 'bg-teal-600', sub: 'SCHUFA genehmigt' },
                ].map(s => (
                  <div key={s.label} onClick={() => setAdminSection('applications')} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
                    <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                      <span className="text-white text-xs font-bold">{s.value}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">{s.value}</div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Recent applications */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Zuletzt aktualisiert</p>
                    <h3 className="text-[14px] font-bold text-slate-900">Aktuelle Anträge</h3>
                  </div>
                  <button onClick={() => setAdminSection('applications')} className="text-[12px] font-semibold text-[#2563eb] hover:underline">Alle anzeigen →</button>
                </div>
                {loadingApps ? (
                  <div className="p-6 space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />)}</div>
                ) : stats.recent.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Noch keine Anträge vorhanden</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {stats.recent.map(app => {
                      const st = STATUS_META[getAppStatusKey(app)];
                      const pay = PAYMENT_META[getPaymentStatusKey(app)];
                      const name = getFullName(app);
                      return (
                        <div key={app.id||app.ref} onClick={() => { setSelectedApp(app); setAdminSection('applications'); }} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-bold shrink-0">{(name[0]||'?').toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{app.email||app.ref||'—'}</p>
                          </div>
                          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>
                          <span className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`}/>{pay.label}</span>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatAppDate(app.updated_at||app.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ ANTRÄGE ══════════ */}
          {adminSection === 'applications' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Datenbank</p>
                    <h3 className="text-[15px] font-bold text-slate-900">Alle Anträge & Leads</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500">{filteredAndSortedApps.length}{filteredAndSortedApps.length !== applications.length && <span className="text-slate-400"> / {applications.length}</span>}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, E-Mail oder Ref-ID…" className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                    {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                  </div>
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                    <option value="all">Alle Zahlungen</option><option value="paid">Bezahlt</option><option value="pending">Ausstehend</option><option value="cancelled">Storniert</option>
                  </select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                    <option value="all">Alle Status</option><option value="lead">Lead</option><option value="in_progress">In Bearbeitung</option><option value="kyc_missing">KYC fehlt</option><option value="ready_for_review">Prüfbereit</option><option value="completed">Abgeschlossen</option><option value="cancelled">Storniert</option>
                  </select>
                  <select value={statusFilter.startsWith('schufa_') ? statusFilter : 'all_schufa'} onChange={e => { if (e.target.value !== 'all_schufa') setStatusFilter(e.target.value); else if (statusFilter.startsWith('schufa_')) setStatusFilter('all'); }} className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm font-medium text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                    <option value="all_schufa">SCHUFA: Alle</option><option value="schufa_uploaded">SCHUFA hochgeladen</option><option value="schufa_missing">SCHUFA fehlt</option><option value="schufa_approved">SCHUFA genehmigt</option>
                  </select>
                </div>
              </div>
              {appsError && (
                <div className="mx-5 mt-4 flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-sm text-rose-700 flex-1">{appsError}</p>
                  <button onClick={fetchApplications} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition-colors">Retry</button>
                </div>
              )}
              {loadingApps ? (
                <div className="p-5 space-y-2">{[...Array(6)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />)}</div>
              ) : filteredAndSortedApps.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-slate-600">{applications.length === 0 ? 'Keine Anträge vorhanden' : 'Keine Treffer'}</p>
                  {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); }} className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Filter zurücksetzen</button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Ref</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Name</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden lg:table-cell">E-Mail</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Paket</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Status</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden md:table-cell">SCHUFA</th>
                      <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Zahlung</th>
                      <th className="text-right py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Datum</th>
                    </tr></thead>
                    <tbody>
                      {filteredAndSortedApps.map(app => {
                        const payKey = getPaymentStatusKey(app);
                        const stKey = getAppStatusKey(app);
                        const pay = PAYMENT_META[payKey];
                        const st = STATUS_META[stKey];
                        const fullName = getFullName(app);
                        return (
                          <tr key={app.id||app.ref} onClick={() => setSelectedApp(app)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                            <td className="py-3.5 px-5"><span className="text-[11px] font-mono text-slate-500">{app.ref||'—'}</span></td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">{(fullName?.[0]||'?').toUpperCase()}</div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{fullName}</p>
                                  <p className="text-[11px] text-slate-400 truncate lg:hidden">{app.email||'—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 hidden lg:table-cell"><span className="text-xs text-slate-600">{app.email||'—'}</span></td>
                            <td className="py-3.5 px-5"><span className="text-xs font-medium text-slate-700">{app.pack_name||'—'}</span></td>
                            <td className="py-3.5 px-5"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span></td>
                            <td className="py-3.5 px-5 hidden md:table-cell">{(() => {
                              const has = !!(app.has_schufa_pdf ?? app.schufa_pdf);
                              const approved = app.schufa_status === 'approved';
                              if (approved) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>Geprüft ✓</span>;
                              if (has) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Hochgeladen</span>;
                              return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"/>Fehlt</span>;
                            })()}</td>
                            <td className="py-3.5 px-5"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`}/>{pay.label}</span></td>
                            <td className="py-3.5 px-5 text-right"><span className="text-xs text-slate-500 whitespace-nowrap">{formatAppDate(app.updated_at||app.created_at)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════ AUFGABEN ══════════ */}
          {adminSection === 'tasks' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Management</p>
                  <h3 className="text-[15px] font-bold text-slate-900">Aufgaben</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-slate-500">{todos.filter(t=>t.status!=='resolved').length} offen</span>
                </div>
              </div>
              <div className="px-6 py-5">
                <form onSubmit={addTodo} className="flex gap-2.5 mb-5">
                  <input type="text" value={newTodoTitle} onChange={e => setNewTodoTitle(e.target.value)} placeholder="Neue Aufgabe hinzufügen…" className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                  <button type="submit" className="px-5 py-2.5 bg-slate-900 text-white text-[12px] font-bold rounded-xl hover:bg-slate-800 transition-colors">Hinzufügen</button>
                </form>
                {loading ? (
                  <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse"/>)}</div>
                ) : todos.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-semibold text-slate-600">Keine Aufgaben</p>
                    <p className="text-xs text-slate-400 mt-1">Füge oben eine neue Aufgabe hinzu.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todos.map((todo, i) => (
                      <div key={todo.id} className={`group flex items-center gap-4 bg-white border border-slate-100 p-4 rounded-2xl transition-all hover:border-slate-200 hover:shadow-sm ${todo.status === 'resolved' ? 'opacity-45' : ''}`} style={{ animationDelay: `${i*40}ms` }}>
                        <button onClick={() => toggleTodoStatus(todo)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${todo.status === 'resolved' ? 'bg-[#2563eb] border-[#2563eb]' : 'border-slate-300 hover:border-blue-400 bg-white'}`}>
                          {todo.status === 'resolved' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold ${todo.status === 'resolved' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{todo.clientName||todo.title||'—'}</p>
                          <p className={`text-[11px] mt-0.5 ${todo.status === 'resolved' ? 'text-slate-300' : 'text-slate-500'}`}>{todo.taskType||''}</p>
                        </div>
                        {todo.urgencyScore > 0 && <div className={`w-2 h-2 rounded-full shrink-0 ${getUrgencyColor(todo.urgencyScore)}`} title={`Priorität ${todo.urgencyScore}/100`} />}
                        <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 transition-all shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {todos.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">{todos.filter(t=>t.status!=='resolved').length} offen · {todos.filter(t=>t.status==='resolved').length} erledigt</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#2563eb] rounded-full transition-all duration-500" style={{ width: `${todos.length>0?(todos.filter(t=>t.status==='resolved').length/todos.length)*100:0}%` }} /></div>
                      <span className="text-xs font-bold text-slate-500">{todos.length>0?Math.round((todos.filter(t=>t.status==='resolved').length/todos.length)*100):0}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ COMMAND OS ══════════ */}
          {adminSection === 'command' && <CeoMindOS />}

          {/* ══════════ LIVE RADAR ══════════ */}
          {adminSection === 'radar' && <LiveRadar />}

          {/* ══════════ WISSENS-DB ══════════ */}
          {adminSection === 'knowledge' && <KnowledgeBase />}

          {/* ══════════ BUCHHALTUNG ══════════ */}
          {adminSection === 'accounting' && <AccountingDashboard />}

          {/* ══════════ KÜNDIGUNGEN ══════════ */}
          {adminSection === 'cancellations' && (
            <div className="space-y-5">
              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                {(['all','pending','confirmed','rejected'] as const).map(f => (
                  <button key={f} onClick={() => setCancellationFilter(f)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border ${
                      cancellationFilter === f
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                    {f === 'all' ? 'Alle' : f === 'pending' ? 'Ausstehend' : f === 'confirmed' ? 'Bestätigt' : 'Abgelehnt'}
                    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      cancellationFilter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {cancellations.filter(c => f === 'all' || c.status === f).length}
                    </span>
                  </button>
                ))}
                <button onClick={fetchCancellations} className="ml-auto p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Neu laden">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Workflow</p>
                    <h3 className="text-[14px] font-bold text-slate-900">Kündigungsanträge</h3>
                  </div>
                  {cancellations.filter(c=>c.status==='pending').length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-full text-[11px] font-bold text-rose-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {cancellations.filter(c=>c.status==='pending').length} ausstehend
                    </span>
                  )}
                </div>

                {cancellationsLoading ? (
                  <div className="p-5 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />)}</div>
                ) : cancellations.filter(c => cancellationFilter === 'all' || c.status === cancellationFilter).length === 0 ? (
                  <div className="py-14 text-center">
                    <p className="text-sm font-semibold text-slate-600">Keine Einträge</p>
                    <p className="text-xs text-slate-400 mt-1">Es liegen keine Kündigungsanträge vor.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">#</th>
                        <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Name</th>
                        <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden lg:table-cell">E-Mail</th>
                        <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden md:table-cell">Ref</th>
                        <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Status</th>
                        <th className="text-right py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Eingereicht</th>
                      </tr></thead>
                      <tbody>
                        {cancellations
                          .filter(c => cancellationFilter === 'all' || c.status === cancellationFilter)
                          .map(c => {
                            const stMeta = c.status === 'confirmed'
                              ? { cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', label: 'Bestätigt' }
                              : c.status === 'rejected'
                              ? { cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', label: 'Abgelehnt' }
                              : { cls: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500 animate-pulse', label: 'Ausstehend' };
                            return (
                              <tr key={c.id} onClick={() => { setSelectedCancellation(c); setCancellationNote(''); }}
                                className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${
                                  selectedCancellation?.id === c.id ? 'bg-blue-50/40' : ''
                                }`}>
                                <td className="py-3.5 px-5"><span className="text-[11px] font-mono text-slate-400">#{c.id}</span></td>
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-bold shrink-0">{((c.first_name||'?')[0]).toUpperCase()}</div>
                                    <div>
                                      <p className="text-[13px] font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                                      <p className="text-[11px] text-slate-400 lg:hidden">{c.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-5 hidden lg:table-cell"><span className="text-xs text-slate-600">{c.email}</span></td>
                                <td className="py-3.5 px-5 hidden md:table-cell"><span className="text-[11px] font-mono text-slate-500">{c.ref}</span></td>
                                <td className="py-3.5 px-5">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${stMeta.cls}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${stMeta.dot}`}/>{stMeta.label}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 text-right"><span className="text-xs text-slate-500 whitespace-nowrap">{formatAppDate(c.created_at)}</span></td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedCancellation && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Antrag #{selectedCancellation.id}</p>
                      <h3 className="text-[15px] font-bold text-slate-900">{selectedCancellation.first_name} {selectedCancellation.last_name}</h3>
                    </div>
                    <button onClick={() => setSelectedCancellation(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-Mail</p><p className="text-[13px] text-slate-700">{selectedCancellation.email}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Referenz</p><p className="text-[13px] font-mono text-slate-700">{selectedCancellation.ref}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Paket</p><p className="text-[13px] text-slate-700">{selectedCancellation.package_name || '—'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Eingegangen</p><p className="text-[13px] text-slate-700">{formatAppDate(selectedCancellation.created_at)}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gewünschtes Datum</p><p className="text-[13px] text-slate-700">{selectedCancellation.cancellation_date ? formatAppDate(selectedCancellation.cancellation_date) : '—'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        selectedCancellation.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                        : selectedCancellation.status === 'rejected' ? 'bg-slate-100 text-slate-500'
                        : 'bg-rose-50 text-rose-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          selectedCancellation.status === 'confirmed' ? 'bg-emerald-500'
                          : selectedCancellation.status === 'rejected' ? 'bg-slate-400'
                          : 'bg-rose-500'
                        }`}/>
                        {selectedCancellation.status === 'confirmed' ? 'Bestätigt' : selectedCancellation.status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                      </span>
                    </div>
                    <div className="col-span-full"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kündigungsgrund</p><p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 rounded-xl px-3.5 py-2.5">{selectedCancellation.reason || '—'}</p></div>
                    {selectedCancellation.admin_note && (
                      <div className="col-span-full"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Admin-Notiz</p><p className="text-[13px] text-slate-700 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">{selectedCancellation.admin_note}</p></div>
                    )}
                    {selectedCancellation.processed_by && (
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bearbeitet von</p><p className="text-[13px] text-slate-700">{selectedCancellation.processed_by} · {formatAppDate(selectedCancellation.processed_at)}</p></div>
                    )}
                  </div>

                  {selectedCancellation.status === 'pending' && (
                    <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-4">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Admin-Entscheidung</p>
                      <textarea
                        value={cancellationNote}
                        onChange={e => setCancellationNote(e.target.value)}
                        placeholder="Optionale Notiz für interne Zwecke…"
                        rows={2}
                        className="w-full text-[13px] border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 bg-white"
                      />
                      {cancellationSuccess && (
                        <p className="text-[12px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">{cancellationSuccess}</p>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleCancellationAction('confirmed')}
                          disabled={cancellationActionLoading}
                          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >✓ Kündigung bestätigen</button>
                        <button
                          onClick={() => handleCancellationAction('rejected')}
                          disabled={cancellationActionLoading}
                          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >✕ Ablehnen</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ═══════════════ DETAIL SLIDE-OVER ═══════════════ */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" style={{ animation: 'fadeIn .2s ease' }} onClick={() => setSelectedApp(null)} />
          <div className="relative ml-auto w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto" style={{ animation: 'slideInRight .3s cubic-bezier(0.16,1,0.3,1)' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-5 flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">Antrag-Details</p>
                <h2 className="text-lg font-bold text-slate-900 truncate">{getFullName(selectedApp)}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-mono text-slate-400">{selectedApp.ref}</span>
                  {(() => { const st=STATUS_META[getAppStatusKey(selectedApp)]; return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>; })()}
                  {(() => { const pay=PAYMENT_META[getPaymentStatusKey(selectedApp)]; return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`}/>{pay.label}</span>; })()}
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0 ml-4" aria-label="Schließen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <SectionHeadline>Persönliches</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Vorname" value={selectedApp.first_name} /><DetailField label="Nachname" value={selectedApp.last_name} />
                <DetailField label="Geburtsdatum" value={selectedApp.birthdate ? formatAppDate(selectedApp.birthdate) : null} /><DetailField label="Nationalität" value={selectedApp.nationality} />
                <DetailField label="Telefon" value={[selectedApp.phone_country_code, selectedApp.phone].filter(Boolean).join(' ')||null} /><DetailField label="E-Mail" value={selectedApp.email} />
                <div className="col-span-2"><DetailField label="Adresse" value={[selectedApp.street,[selectedApp.zip,selectedApp.city].filter(Boolean).join(' '),selectedApp.country].filter(Boolean).join(', ')||null} /></div>
                <DetailField label="Wohnsituation" value={selectedApp.housing} />
              </div>

              <SectionHeadline>Finanzen</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Einkommen (netto)" value={selectedApp.income!=null?formatCurrency(selectedApp.income):null} /><DetailField label="Miete" value={selectedApp.rent!=null?formatCurrency(selectedApp.rent):null} />
                <DetailField label="Schulden" value={selectedApp.debts!=null?formatCurrency(selectedApp.debts):null} /><DetailField label="Wunschlimit" value={selectedApp.wanted_limit!=null?formatCurrency(selectedApp.wanted_limit):null} />
                <DetailField label="Genehmigtes Limit" value={selectedApp.approved_limit!=null?formatCurrency(selectedApp.approved_limit):null} /><DetailField label="Beschäftigung" value={selectedApp.employment} />
                <DetailField label="Arbeitgeber" value={selectedApp.employer} /><DetailField label="Beschäftigt seit" value={selectedApp.employed_since} />
              </div>

              <SectionHeadline>Setup & Vertrag</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Paket" value={selectedApp.pack_name} /><DetailField label="Paket-Key" value={selectedApp.pack_key} />
                <DetailField label="Verwendungszweck" value={selectedApp.purpose} /><DetailField label="Abrechnung" value={selectedApp.billing} />
                <DetailField label="Zahlungsmethode" value={selectedApp.billing_method} /><DetailField label="Gehaltseingang" value={selectedApp.salary_receipt_day} />
                <DetailField label="Add-on" value={selectedApp.addon} /><DetailField label="NFC" value={selectedApp.nfc} />
                <div className="col-span-2"><DetailField label="IBAN" value={selectedApp.iban} mono /></div>
                <div className="col-span-2"><DetailField label="Stripe Customer" value={selectedApp.stripe_customer_id} mono /></div>
                <div className="col-span-2"><DetailField label="Stripe Subscription" value={selectedApp.stripe_subscription_id} mono /></div>
              </div>

              {(selectedApp.company_name || selectedApp.type === 'business') && (<>
                <SectionHeadline>Unternehmen</SectionHeadline>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                  <DetailField label="Firmenname" value={selectedApp.company_name} /><DetailField label="Rechtsform" value={selectedApp.legal_form} />
                  <DetailField label="Steuer-ID" value={selectedApp.tax_id} /><DetailField label="Gegründet" value={selectedApp.established_year} />
                  <DetailField label="Branche" value={selectedApp.industry} /><DetailField label="Geschäftstyp" value={selectedApp.business_type} />
                  <DetailField label="Jahresumsatz" value={selectedApp.annual_revenue!=null?formatCurrency(selectedApp.annual_revenue):null} /><DetailField label="Mitarbeiter" value={selectedApp.employees} />
                  <DetailField label="Ansprechpartner" value={selectedApp.contact_name} /><DetailField label="Kontakt-Email" value={selectedApp.contact_email} />
                </div>
              </>)}

              <SectionHeadline>KYC & Dokumente</SectionHeadline>
              <div className="space-y-2.5 pb-6 border-b border-slate-100">
                <KycRow label="Kontoauszug" available={!!(selectedApp.has_bank_statement_pdf??selectedApp.bank_statement_pdf)} downloadUrl={selectedApp.ref?`/api/fiaon/admin/applications/${selectedApp.ref}/document/bank_statement`:undefined} />
                <KycRow label="Ausweisdokument" available={!!(selectedApp.has_id_card_pdf??selectedApp.id_card_pdf)} downloadUrl={selectedApp.ref?`/api/fiaon/admin/applications/${selectedApp.ref}/document/id_card`:undefined} />
                <KycRow label="SCHUFA-Nachweis" available={!!(selectedApp.has_schufa_pdf??selectedApp.schufa_pdf)} downloadUrl={selectedApp.ref&&(selectedApp.has_schufa_pdf??selectedApp.schufa_pdf)?`/api/fiaon/admin/applications/${selectedApp.ref}/document/schufa`:undefined} schufaStatus={selectedApp.schufa_status} />
                <div className="grid grid-cols-4 gap-3 pt-1">
                  <DetailField label="Hochgeladen" value={selectedApp.documents_uploaded_at?formatAppDate(selectedApp.documents_uploaded_at):null} />
                  <DetailField label="AGB" value={selectedApp.consent_agb?'✓ Akzeptiert':null} />
                  <DetailField label="SCHUFA" value={selectedApp.consent_schufa?'✓ Akzeptiert':null} />
                  <DetailField label="Vertrag" value={selectedApp.consent_contract?'✓ Akzeptiert':null} />
                </div>
              </div>

              <SectionHeadline>Profil-Ergänzungen</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Umgezogen (6 Mo.)" value={selectedApp.moved_recently ? 'Ja' : 'Nein'} />
                <DetailField label="Frühere Anschrift" value={[selectedApp.previous_street, [selectedApp.previous_zip, selectedApp.previous_city].filter(Boolean).join(' '), selectedApp.previous_country].filter(Boolean).join(', ') || null} />
                <DetailField label="Reisepass-Nr." value={selectedApp.passport_number} mono />
                <DetailField label="Pass gültig bis" value={selectedApp.passport_expiry ? new Date(selectedApp.passport_expiry).toLocaleDateString('de-DE') : null} />
                <DetailField label="Weitere Einkünfte" value={selectedApp.has_additional_income ? 'Ja' : 'Nein'} />
                <DetailField label="Einkunftsart" value={selectedApp.additional_income_sources} />
                <DetailField label="Zusatz-Einkommen" value={selectedApp.additional_income_amount != null ? `€ ${selectedApp.additional_income_amount}/mtl.` : null} />
                <div className="col-span-2">
                  {selectedApp.expenses_food != null && (
                    <div className="grid grid-cols-3 gap-2">
                      {[['Lebensmittel', selectedApp.expenses_food],['Mobilität', selectedApp.expenses_transport],['Versicherungen', selectedApp.expenses_insurance],['Kredite', selectedApp.expenses_loans],['Abonnements', selectedApp.expenses_subscriptions],['Sonstiges', selectedApp.expenses_other]].map(([l,v]) => (
                        <div key={String(l)} className="text-center">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{l}</div>
                          <div className="text-[12px] font-bold text-slate-700 mt-0.5">{v != null ? `€ ${v}` : '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <DetailField label="Profil gespeichert" value={selectedApp.profile_completed_at ? new Date(selectedApp.profile_completed_at).toLocaleDateString('de-DE') : null} />
                </div>
              </div>

              <SectionHeadline>Admin Entscheidung</SectionHeadline>
              <div className="space-y-4 pb-6 border-b border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${selectedApp.kyc_status==='approved'?'bg-emerald-50 text-emerald-700':selectedApp.kyc_status==='changes_requested'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedApp.kyc_status==='approved'?'bg-emerald-500':selectedApp.kyc_status==='changes_requested'?'bg-amber-500':'bg-slate-400'}`}/>
                    Dokumente: {selectedApp.kyc_status==='approved'?'Genehmigt':selectedApp.kyc_status==='changes_requested'?'Änderung angefordert':'In Prüfung'}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${selectedApp.account_status==='active'?'bg-emerald-50 text-emerald-700':selectedApp.account_status==='suspended'?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedApp.account_status==='active'?'bg-emerald-500':selectedApp.account_status==='suspended'?'bg-rose-500':'bg-slate-400'}`}/>
                    Konto: {selectedApp.account_status==='active'?'Aktiv':selectedApp.account_status==='suspended'?'Gesperrt':'Ausstehend'}
                  </span>
                  {reviewSuccess && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-white">{reviewSuccess} ✓</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => sendReview('approved',undefined,'')} disabled={reviewLoading} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">✓ Dokumente genehmigen</button>
                  <button onClick={() => sendReview(undefined,'active','')} disabled={reviewLoading} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">⚡ Konto aktivieren</button>
                  <button onClick={() => sendReview(undefined,'suspended','')} disabled={reviewLoading} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50 transition-colors">✕ Konto sperren</button>
                </div>
                <div className="space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nachricht an Kunde + Dokument neu anfordern</p>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="z.B. Ihr Kontoauszug ist leider nicht lesbar. Bitte laden Sie ein klareres PDF hoch." rows={3} className="w-full text-[13px] border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 bg-white" />
                  <div className="flex gap-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={reuploadBank} onChange={e => setReuploadBank(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" /><span className="text-[12px] text-slate-700 font-medium">Kontoauszug</span></label>
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={reuploadId} onChange={e => setReuploadId(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" /><span className="text-[12px] text-slate-700 font-medium">Ausweisdokument</span></label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendReview('changes_requested',undefined)} disabled={reviewLoading||!reviewNote.trim()||(!reuploadBank&&!reuploadId)} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">Änderung anfordern + Senden</button>
                    {selectedApp.admin_note && <button onClick={() => sendReview(undefined,undefined,'',false,false)} disabled={reviewLoading} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">Nachricht löschen</button>}
                  </div>
                  {selectedApp.admin_note && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3.5 py-2.5 space-y-0.5">
                      <p>Nachricht: „{selectedApp.admin_note}"</p>
                      <p className="text-slate-400">Angefordert: {[selectedApp.reupload_bank_statement&&'Kontoauszug',selectedApp.reupload_id_card&&'Ausweis'].filter(Boolean).join(', ')||'—'}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Profil-Rückfrage an Kunde</p>
                  <textarea value={profileNote} onChange={e => setProfileNote(e.target.value)} placeholder="z. B. Bitte ergänzen Sie Ihre Reisepassnummer und das Ablaufdatum." rows={2} className="w-full text-[13px] border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 text-slate-700 bg-white" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { const body: any = { adminProfileNote: profileNote.trim(), profileChangesRequested: true }; fetch(`/api/fiaon/admin/applications/${selectedApp.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.ok && (setSelectedApp({...selectedApp, admin_profile_note: profileNote.trim(), profile_changes_requested: true}), setProfileNote(''), setReviewSuccess('Profil-Rückfrage gesendet'), setTimeout(() => setReviewSuccess(null), 2500))); }}
                      disabled={reviewLoading || !profileNote.trim()}
                      className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                    >Profil-Rückfrage senden</button>
                    {selectedApp.admin_profile_note && (
                      <button onClick={() => { fetch(`/api/fiaon/admin/applications/${selectedApp.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ adminProfileNote: '', profileChangesRequested: false }) }).then(r => r.ok && setSelectedApp({...selectedApp, admin_profile_note: null, profile_changes_requested: false})); }} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Rückfrage schließen</button>
                    )}
                  </div>
                  {selectedApp.admin_profile_note && (
                    <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                      <p className="font-semibold text-amber-700 mb-0.5">Aktive Rückfrage:</p>
                      <p>„{selectedApp.admin_profile_note}"</p>
                      <p className="text-amber-500 mt-0.5">{selectedApp.profile_changes_requested ? 'Ausstehend — Kunde wurde benachrichtigt' : 'Beantwortet'}</p>
                    </div>
                  )}
                </div>
              </div>

              <SectionHeadline>SCHUFA-Nachweis Prüfung</SectionHeadline>
              <div className="space-y-4 pb-6 border-b border-slate-100">
                {/* Status-Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const has = !!(selectedApp.has_schufa_pdf ?? selectedApp.schufa_pdf);
                    const s = selectedApp.schufa_status;
                    if (!has) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>SCHUFA: Nicht hochgeladen</span>;
                    if (s === 'approved') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-teal-50 text-teal-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>SCHUFA: Genehmigt ✓</span>;
                    if (s === 'requested') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"/>SCHUFA: Neues Dokument angefordert</span>;
                    if (s === 'rejected') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>SCHUFA: Abgelehnt</span>;
                    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>SCHUFA: Hochgeladen — Ausstehende Prüfung</span>;
                  })()}
                  {reviewSuccess && reviewSuccess.startsWith('SCHUFA') && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-white">{reviewSuccess}</span>}
                </div>

                {/* Quick Actions */}
                {(selectedApp.has_schufa_pdf ?? selectedApp.schufa_pdf) && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => sendSchufaAction('approved', '')}
                      disabled={reviewLoading || selectedApp.schufa_status === 'approved'}
                      className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors"
                    >✓ SCHUFA genehmigen</button>
                    <button
                      onClick={() => sendSchufaAction('rejected', '')}
                      disabled={reviewLoading || selectedApp.schufa_status === 'rejected'}
                      className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 transition-colors"
                    >✕ SCHUFA ablehnen</button>
                    {selectedApp.schufa_status === 'approved' && (
                      <button
                        onClick={() => sendSchufaAction('pending', '')}
                        disabled={reviewLoading}
                        className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                      >Genehmigung zurücksetzen</button>
                    )}
                  </div>
                )}

                {/* Rückfrage / Neues Dokument anfordern */}
                <div className="space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nachricht an Kunde (SCHUFA)</p>
                  <textarea
                    value={schufaNote}
                    onChange={e => setSchufaNote(e.target.value)}
                    placeholder="z. B. Ihre SCHUFA-Auskunft ist nicht lesbar. Bitte laden Sie das Dokument erneut hoch."
                    rows={2}
                    className="w-full text-[13px] border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 text-slate-700 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendSchufaAction('requested', schufaNote.trim())}
                      disabled={reviewLoading || !schufaNote.trim()}
                      className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                    >Neues SCHUFA-Dokument anfordern</button>
                    {selectedApp.admin_schufa_note && (
                      <button
                        onClick={() => sendSchufaAction(selectedApp.schufa_status || 'pending', '')}
                        disabled={reviewLoading}
                        className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      >Nachricht löschen</button>
                    )}
                  </div>
                  {selectedApp.admin_schufa_note && (
                    <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                      <p className="font-semibold text-amber-700 mb-0.5">Aktive SCHUFA-Nachricht:</p>
                      <p>„{selectedApp.admin_schufa_note}"</p>
                    </div>
                  )}
                </div>
              </div>

              <SectionHeadline>Meta</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <DetailField label="Typ" value={selectedApp.type} /><DetailField label="Step" value={selectedApp.current_step} />
                <DetailField label="Erstellt" value={formatAppDate(selectedApp.created_at)} /><DetailField label="Aktualisiert" value={formatAppDate(selectedApp.updated_at)} />
                <DetailField label="Eingereicht" value={selectedApp.submitted_at?formatAppDate(selectedApp.submitted_at):null} /><DetailField label="Abgeschlossen" value={selectedApp.completed_at?formatAppDate(selectedApp.completed_at):null} />
                <div className="col-span-2"><DetailField label="IP-Adresse" value={selectedApp.ip} mono /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4 mt-6 first:mt-0">
      {children}
    </p>
  );
}

function DetailField({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  const isEmpty = value === null || value === undefined || value === '' || value === false;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">{label}</p>
      {isEmpty ? (
        <p className="text-sm italic text-slate-400">Nicht angegeben</p>
      ) : (
        <p className={`text-sm font-medium text-slate-800 break-words ${mono ? 'font-mono text-xs' : ''}`}>{String(value)}</p>
      )}
    </div>
  );
}

function KycRow({ label, available, downloadUrl, schufaStatus }: { label: string; available: boolean; downloadUrl?: string; schufaStatus?: string }) {
  const statusBadge = schufaStatus === 'approved'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Genehmigt ✓</span>
    : schufaStatus === 'requested'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Neu angefordert</span>
    : schufaStatus === 'rejected'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Abgelehnt</span>
    : available
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">In Prüfung</span>
    : null;

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl bg-white border ${schufaStatus === 'approved' ? 'border-teal-200' : schufaStatus === 'rejected' ? 'border-rose-200' : 'border-slate-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${available ? (schufaStatus === 'approved' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-white') : 'bg-slate-100 text-slate-400'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            {statusBadge}
          </div>
          <p className={`text-[11px] ${available ? 'text-emerald-600' : 'text-slate-400'}`}>
            {available ? 'Vorhanden' : 'Nicht hochgeladen'}
          </p>
        </div>
      </div>
      {available && downloadUrl ? (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Öffnen
        </a>
      ) : (
        <span className="text-[11px] font-medium text-slate-400">—</span>
      )}
    </div>
  );
}
