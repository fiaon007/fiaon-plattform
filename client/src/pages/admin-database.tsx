import { useState, useEffect, useMemo } from "react";
import CeoMindOS from "@/components/admin/CeoMindOS";
import LiveRadar from "@/components/admin/LiveRadar";
import KnowledgeBase from "@/components/admin/KnowledgeBase";
import AccountingDashboard from "@/components/admin/AccountingDashboard";
import MinimalistGlassLauncher from "@/components/layout/MinimalistGlassLauncher";
import AdminApplicationsManager from "@/components/admin/AdminApplicationsManager";
import AdminRevenueDashboard from "@/components/admin/AdminRevenueDashboard";
import AdminInvestorsManager from "@/components/admin/AdminInvestorsManager";
import AdminLedgerManager from "@/components/admin/AdminLedgerManager";

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
  const [adminSection, setAdminSection] = useState<'overview'|'applications'|'tasks'|'command'|'radar'|'knowledge'|'accounting'|'revenue'|'investors'|'cancellations'|'ledger'>('overview');

  const [cancellations, setCancellations] = useState<any[]>([]);
  const [cancellationsLoading, setCancellationsLoading] = useState(false);
  const [selectedCancellation, setSelectedCancellation] = useState<any | null>(null);
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationActionLoading, setCancellationActionLoading] = useState(false);
  const [cancellationSuccess, setCancellationSuccess] = useState<string | null>(null);
  const [cancellationFilter, setCancellationFilter] = useState<'all'|'pending'|'confirmed'|'rejected'>('pending');

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
    setLoadingApps(true);
    try {
      const res = await fetch('/api/fiaon/admin/applications', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        const apps = extractApps(json);
        setApplications(apps);
      }
    } catch (err) {
      console.error('[ADMIN-FETCH] error:', err);
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
    { id: 'revenue'      as const, label: 'Umsatz & Stripe', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { id: 'accounting'   as const, label: 'Buchhaltung', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    { id: 'investors'    as const, label: 'Investoren',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { id: 'cancellations' as const, label: 'Kündigungen', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, badge: cancellations.filter(c=>c.status==='pending').length > 0 ? String(cancellations.filter(c=>c.status==='pending').length) : undefined },
    { id: 'ledger'        as const, label: 'Ausbuchung',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
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
                        <div key={app.id||app.ref} onClick={() => { setAdminSection('applications'); }} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
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
          {adminSection === 'applications' && <AdminApplicationsManager />}

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

          {/* ══════════ UMSATZ & STRIPE ══════════ */}
          {adminSection === 'revenue' && <AdminRevenueDashboard />}

          {/* ══════════ BUCHHALTUNG ══════════ */}
          {adminSection === 'accounting' && <AccountingDashboard />}

          {/* ══════════ INVESTOREN ══════════ */}
          {adminSection === 'investors' && <AdminInvestorsManager />}

          {/* ══════════ AUSBUCHUNG / LEDGER ══════════ */}
          {adminSection === 'ledger' && <AdminLedgerManager />}

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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
