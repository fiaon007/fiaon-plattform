import { useState, useEffect, useMemo } from "react";

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

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/fiaon/admin/applications', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setApplications(Array.isArray(json?.data) ? json.data : []);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
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
        if (statusFilter !== 'all' && getAppStatusKey(app) !== statusFilter) return false;
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

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <div className="flex min-h-screen relative z-10">
        {/* Modern Sidebar */}
        <div className="w-64 fiaon-glass-panel border-r border-white/20 flex flex-col">
          {/* Logo Section */}
          <div className="p-6 border-b border-white/20">
            <h1 className="text-2xl font-bold fiaon-gradient-text-animated mb-1">FIAON</h1>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  item.active
                    ? "fiaon-glass-card-selected scale-[1.02]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
                style={{ animation: `fadeInUp 0.4s ease ${index * 80}ms both` }}
              >
                {item.icon === "home" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
                {item.icon === "users" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {item.icon === "credit-card" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                )}
                {item.icon === "bar-chart" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                )}
                {item.icon === "settings" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                )}
                <span className="text-[13px] font-semibold">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-white/20">
            <div className="fiaon-glass-panel rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center text-white font-semibold">
                  J
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">Justin</p>
                  <p className="text-[11px] text-gray-500 truncate">Admin</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="animate-[fadeInUp_.6s_ease]">
            {/* Time Display */}
            <div className="mb-4">
              <div className="text-[64px] font-bold fiaon-gradient-text-animated tracking-tight">
                {currentTime}
              </div>
            </div>

            {/* Animated Greeting */}
            <div className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 mb-4">
                {typedText}
                <span className="inline-block w-0.5 h-12 bg-[#2563eb] ml-2 animate-pulse" />
              </h1>
              <p className="text-[15px] text-gray-500 max-w-lg leading-relaxed">
                Willkommen zurück in deinem Admin Dashboard. Alles läuft reibungslos.
              </p>
            </div>

            {/* TODO List Section - Bento-Luxury Design */}
            <div className="mb-8">
              <div className="bg-gradient-to-br from-[#FEFEFE] to-[#FAFAFA] p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 animate-[fadeInUp_.6s_ease]">
                {/* Overline Label */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">TODO ÜBERSICHT</p>
                    <h3 className="text-lg font-semibold text-slate-800">Aufgaben Management</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-slate-600">{todos.filter(t => t.status !== 'resolved').length} aktiv</span>
                  </div>
                </div>

                {/* Add Todo Input - Glassmorphismus */}
                <form onSubmit={addTodo} className="mb-8">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        placeholder="Neue Aufgabe hinzufügen..."
                        className="w-full px-5 py-4 rounded-xl bg-white/80 backdrop-blur-sm border-2 border-slate-200/80 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-700 placeholder-slate-400 shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-xs font-bold uppercase tracking-[0.15em] rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </form>

                {/* Todo List - Skeuomorphismus 3.0 */}
                {loading ? (
                  <div className="text-center py-16">
                    <div className="inline-block w-8 h-8 border-3 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400 mt-3">Laden...</p>
                  </div>
                ) : todos.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-inner">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Keine Aufgaben vorhanden</p>
                    <p className="text-xs text-slate-400 mt-1">Füge deine erste Aufgabe hinzu!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {todos.map((todo, index) => (
                      <div
                        key={todo.id}
                        className={`group flex items-center gap-4 bg-white border-2 border-slate-100 p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.08)] hover:border-slate-200 ${
                          todo.status === 'resolved' ? 'opacity-40' : ''
                        }`}
                        style={{
                          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 8px -2px rgba(0,0,0,0.04)',
                          animation: `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 60}ms both`
                        }}
                      >
                        {/* Custom Checkbox - Premium */}
                        <button
                          onClick={() => toggleTodoStatus(todo)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                            todo.status === 'resolved'
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-transparent shadow-lg shadow-blue-500/30'
                              : 'border-slate-300 hover:border-blue-400 hover:ring-4 hover:ring-blue-100 bg-white'
                          }`}
                        >
                          {todo.status === 'resolved' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 12 10 16 18 8" />
                            </svg>
                          )}
                        </button>

                        {/* Todo Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <p className={`text-sm font-semibold transition-all duration-300 ${
                              todo.status === 'resolved' ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}>
                              {todo.clientName || todo.title || 'Unbekannt'}
                            </p>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                              todo.clientPackage === 'Ultra' || todo.clientPackage === 'High End' 
                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' 
                                : todo.clientPackage === 'Pro' 
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                            }`}>
                              {todo.clientPackage}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`text-xs font-medium transition-all duration-300 ${
                              todo.status === 'resolved' ? 'text-slate-300' : 'text-slate-500'
                            }`}>
                              {todo.taskType}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${getUrgencyColor(todo.urgencyScore)}`}></div>
                              <span className={`text-xs font-semibold ${
                                todo.status === 'resolved' ? 'text-slate-300' : 'text-slate-600'
                              }`}>
                                {todo.urgencyScore}/100
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl hover:bg-red-50 transition-all duration-300 hover:scale-110"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status Footer */}
                <div className="mt-6 pt-5 border-t-2 border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {todos.filter(t => t.status !== 'resolved').length} offen · {todos.filter(t => t.status === 'resolved').length} erledigt
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${todos.length > 0 ? (todos.filter(t => t.status === 'resolved').length / todos.length) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        {todos.length > 0 ? Math.round((todos.filter(t => t.status === 'resolved').length / todos.length) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Applications Section - Anträge & Leads */}
            <div className="mt-8">
              <div className="bg-white rounded-3xl p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 animate-[fadeInUp_.6s_ease]">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">COMMAND CENTER</p>
                    <h3 className="text-lg font-bold text-slate-900">Aktuelle Anträge & Leads</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {filteredAndSortedApps.length}
                      {filteredAndSortedApps.length !== applications.length && (
                        <span className="text-slate-400"> / {applications.length}</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Controls Bar — Search + Filters */}
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                  {/* Search */}
                  <div className="relative flex-1">
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name, E-Mail oder Ref-ID suchen..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 text-slate-400"
                        aria-label="Suche leeren"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Payment filter */}
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
                  >
                    <option value="all">Alle Zahlungen</option>
                    <option value="paid">Bezahlt</option>
                    <option value="pending">Ausstehend</option>
                    <option value="cancelled">Storniert</option>
                  </select>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
                  >
                    <option value="all">Alle Status</option>
                    <option value="lead">Lead</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="kyc_missing">KYC fehlt</option>
                    <option value="ready_for_review">Prüfbereit</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="cancelled">Storniert</option>
                  </select>
                </div>

                {/* Applications List */}
                {loadingApps ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/60 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-slate-200 rounded w-1/3" />
                          <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                        </div>
                        <div className="h-5 w-20 bg-slate-200 rounded-full" />
                        <div className="h-5 w-20 bg-slate-200 rounded-full" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                    ))}
                  </div>
                ) : filteredAndSortedApps.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {applications.length === 0 ? 'Noch keine Anträge' : 'Keine Anträge gefunden'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {applications.length === 0
                        ? 'Neue Kunden-Anträge erscheinen hier automatisch.'
                        : 'Passe Suche oder Filter an, um mehr Ergebnisse zu sehen.'}
                    </p>
                    {applications.length > 0 && (searchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && (
                      <button
                        onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); }}
                        className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Filter zurücksetzen
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Ref</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Name</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400 hidden lg:table-cell">E-Mail</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Paket</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Status</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Zahlung</th>
                          <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedApps.map((app) => {
                          const payKey = getPaymentStatusKey(app);
                          const stKey = getAppStatusKey(app);
                          const pay = PAYMENT_META[payKey];
                          const st = STATUS_META[stKey];
                          const fullName = getFullName(app);
                          const initial = (fullName?.[0] || '?').toUpperCase();
                          return (
                            <tr
                              key={app.id || app.ref}
                              onClick={() => setSelectedApp(app)}
                              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="py-4 px-4">
                                <span className="text-[11px] font-mono text-slate-500">{app.ref || '—'}</span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{fullName}</p>
                                    <p className="text-[11px] text-slate-400 truncate lg:hidden">{app.email || '—'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 hidden lg:table-cell">
                                <span className="text-xs text-slate-600 truncate">{app.email || <span className="text-slate-300">—</span>}</span>
                              </td>
                              <td className="py-4 px-4">
                                <span className="text-xs font-medium text-slate-700">
                                  {app.pack_name || <span className="text-slate-300">—</span>}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {st.label}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pay.cls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`} />
                                  {pay.label}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{formatAppDate(app.updated_at || app.created_at)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-Over Detail Panel */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-[fadeIn_.2s_ease]"
            onClick={() => setSelectedApp(null)}
          />
          {/* Panel */}
          <div
            className="relative ml-auto w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto animate-[slideInRight_.35s_cubic-bezier(0.16,1,0.3,1)]"
            style={{ animation: 'slideInRight .35s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">Antrag-Details</p>
                <h2 className="text-xl font-bold text-slate-900 truncate">{getFullName(selectedApp)}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs font-mono text-slate-500">{selectedApp.ref}</span>
                  {(() => {
                    const st = STATUS_META[getAppStatusKey(selectedApp)];
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                  {(() => {
                    const pay = PAYMENT_META[getPaymentStatusKey(selectedApp)];
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pay.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`} />
                        {pay.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Schließen"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body - Editorial Sections */}
            <div className="px-8 py-6">
              {/* Persönliches */}
              <SectionHeadline>Persönliches</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Vorname" value={selectedApp.first_name} />
                <DetailField label="Nachname" value={selectedApp.last_name} />
                <DetailField label="Geburtsdatum" value={selectedApp.birthdate ? formatAppDate(selectedApp.birthdate) : null} />
                <DetailField label="Nationalität" value={selectedApp.nationality} />
                <DetailField label="Telefon" value={[selectedApp.phone_country_code, selectedApp.phone].filter(Boolean).join(' ') || null} />
                <DetailField label="E-Mail" value={selectedApp.email} />
                <div className="col-span-2">
                  <DetailField label="Adresse" value={[selectedApp.street, [selectedApp.zip, selectedApp.city].filter(Boolean).join(' '), selectedApp.country].filter(Boolean).join(', ') || null} />
                </div>
                <DetailField label="Wohnsituation" value={selectedApp.housing} />
              </div>

              {/* Finanzen */}
              <SectionHeadline>Finanzen</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Einkommen (netto)" value={selectedApp.income != null ? formatCurrency(selectedApp.income) : null} />
                <DetailField label="Miete" value={selectedApp.rent != null ? formatCurrency(selectedApp.rent) : null} />
                <DetailField label="Schulden" value={selectedApp.debts != null ? formatCurrency(selectedApp.debts) : null} />
                <DetailField label="Wunschlimit" value={selectedApp.wanted_limit != null ? formatCurrency(selectedApp.wanted_limit) : null} />
                <DetailField label="Genehmigtes Limit" value={selectedApp.approved_limit != null ? formatCurrency(selectedApp.approved_limit) : null} />
                <DetailField label="Beschäftigung" value={selectedApp.employment} />
                <DetailField label="Arbeitgeber" value={selectedApp.employer} />
                <DetailField label="Beschäftigt seit" value={selectedApp.employed_since} />
              </div>

              {/* Setup / Vertrag */}
              <SectionHeadline>Setup & Vertrag</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                <DetailField label="Paket" value={selectedApp.pack_name} />
                <DetailField label="Paket-Key" value={selectedApp.pack_key} />
                <DetailField label="Verwendungszweck" value={selectedApp.purpose} />
                <DetailField label="Abrechnung" value={selectedApp.billing} />
                <DetailField label="Zahlungsmethode" value={selectedApp.billing_method} />
                <DetailField label="Gehaltseingang" value={selectedApp.salary_receipt_day} />
                <DetailField label="Add-on" value={selectedApp.addon} />
                <DetailField label="NFC" value={selectedApp.nfc} />
                <div className="col-span-2">
                  <DetailField label="IBAN" value={selectedApp.iban} mono />
                </div>
                <div className="col-span-2">
                  <DetailField label="Stripe Customer" value={selectedApp.stripe_customer_id} mono />
                </div>
                <div className="col-span-2">
                  <DetailField label="Stripe Subscription" value={selectedApp.stripe_subscription_id} mono />
                </div>
              </div>

              {/* Business */}
              {(selectedApp.company_name || selectedApp.type === 'business') && (
                <>
                  <SectionHeadline>Unternehmen</SectionHeadline>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5 pb-6 border-b border-slate-100">
                    <DetailField label="Firmenname" value={selectedApp.company_name} />
                    <DetailField label="Rechtsform" value={selectedApp.legal_form} />
                    <DetailField label="Steuer-ID" value={selectedApp.tax_id} />
                    <DetailField label="Gegründet" value={selectedApp.established_year} />
                    <DetailField label="Branche" value={selectedApp.industry} />
                    <DetailField label="Geschäftstyp" value={selectedApp.business_type} />
                    <DetailField label="Jahresumsatz" value={selectedApp.annual_revenue != null ? formatCurrency(selectedApp.annual_revenue) : null} />
                    <DetailField label="Mitarbeiter" value={selectedApp.employees} />
                    <DetailField label="Monatliche Kosten" value={selectedApp.monthly_expenses != null ? formatCurrency(selectedApp.monthly_expenses) : null} />
                    <DetailField label="Ansprechpartner" value={selectedApp.contact_name} />
                    <DetailField label="Kontakt-Email" value={selectedApp.contact_email} />
                    <DetailField label="Kontakt-Tel." value={selectedApp.contact_phone} />
                  </div>
                </>
              )}

              {/* KYC & Dokumente */}
              <SectionHeadline>KYC & Dokumente</SectionHeadline>
              <div className="space-y-3 pb-6 border-b border-slate-100">
                <KycRow
                  label="Kontoauszug"
                  available={!!(selectedApp.has_bank_statement_pdf ?? selectedApp.bank_statement_pdf)}
                  downloadUrl={selectedApp.ref ? `/api/fiaon/admin/applications/${selectedApp.ref}/document/bank_statement` : undefined}
                />
                <KycRow
                  label="Ausweisdokument"
                  available={!!(selectedApp.has_id_card_pdf ?? selectedApp.id_card_pdf)}
                  downloadUrl={selectedApp.ref ? `/api/fiaon/admin/applications/${selectedApp.ref}/document/id_card` : undefined}
                />
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <DetailField label="Hochgeladen" value={selectedApp.documents_uploaded_at ? formatAppDate(selectedApp.documents_uploaded_at) : null} />
                  <DetailField label="AGB" value={selectedApp.consent_agb ? '✓ Akzeptiert' : null} />
                  <DetailField label="SCHUFA" value={selectedApp.consent_schufa ? '✓ Akzeptiert' : null} />
                  <DetailField label="Vertrag" value={selectedApp.consent_contract ? '✓ Akzeptiert' : null} />
                </div>
              </div>

              {/* Meta */}
              <SectionHeadline>Meta</SectionHeadline>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <DetailField label="Typ" value={selectedApp.type} />
                <DetailField label="Aktueller Step" value={selectedApp.current_step} />
                <DetailField label="Erstellt" value={formatAppDate(selectedApp.created_at)} />
                <DetailField label="Aktualisiert" value={formatAppDate(selectedApp.updated_at)} />
                <DetailField label="Eingereicht" value={selectedApp.submitted_at ? formatAppDate(selectedApp.submitted_at) : null} />
                <DetailField label="Abgeschlossen" value={selectedApp.completed_at ? formatAppDate(selectedApp.completed_at) : null} />
                <div className="col-span-2">
                  <DetailField label="IP-Adresse" value={selectedApp.ip} mono />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
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

function KycRow({ label, available, downloadUrl }: { label: string; available: boolean; downloadUrl?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${available ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
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
