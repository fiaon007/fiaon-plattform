import { useState, useEffect } from "react";

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
      const res = await fetch('/api/database/tables/fiaon_applications/data?limit=200', {
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

  const getPaymentBadge = (status: string | null | undefined) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'paid') return { label: 'Bezahlt', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    if (s === 'cancelled') return { label: 'Storniert', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
    return { label: 'Ausstehend', cls: 'bg-amber-50 text-amber-600 border-amber-100' };
  };

  const getAppStatusBadge = (status: string | null | undefined) => {
    const s = (status || 'started').toLowerCase();
    if (s === 'completed') return { label: 'Abgeschlossen', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    if (s === 'documents_submitted') return { label: 'KYC eingereicht', cls: 'bg-blue-50 text-blue-600 border-blue-100' };
    if (s === 'started' || s === 'in_progress') return { label: 'In Bearbeitung', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
    // KYC fehlt / andere
    return { label: 'KYC fehlt', cls: 'bg-rose-50 text-rose-600 border-rose-100' };
  };

  const getPackageBadge = (pack: string | null | undefined) => {
    const p = (pack || '').toLowerCase();
    if (p.includes('ultra') || p.includes('high')) return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
    if (p.includes('pro')) return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    if (p.includes('starter')) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  };

  const getFullName = (app: any) => {
    const parts = [app?.first_name, app?.last_name].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    return app?.company_name || app?.contact_name || app?.email || '—';
  };

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
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 animate-[fadeInUp_.6s_ease]">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">KUNDEN DATENBANK</p>
                    <h3 className="text-lg font-bold text-slate-900">Aktuelle Anträge & Leads</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500">Total:</span>
                    <span className="text-xs font-bold text-slate-800">{applications.length}</span>
                  </div>
                </div>

                {/* Applications List */}
                {loadingApps ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-slate-200 rounded w-1/3" />
                          <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                        </div>
                        <div className="h-6 w-20 bg-slate-200 rounded-full" />
                        <div className="h-6 w-20 bg-slate-200 rounded-full" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                    ))}
                  </div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-inner">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Noch keine Anträge</p>
                    <p className="text-xs text-slate-400 mt-1">Neue Kunden-Anträge erscheinen hier automatisch.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Ref-ID</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Name</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Paket</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Status</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Zahlung</th>
                          <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => {
                          const payBadge = getPaymentBadge(app.payment_status);
                          const stBadge = getAppStatusBadge(app.status);
                          const fullName = getFullName(app);
                          const initial = (fullName?.[0] || '?').toUpperCase();
                          return (
                            <tr
                              key={app.id || app.ref}
                              onClick={() => setSelectedApp(app)}
                              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="py-4 px-4">
                                <span className="text-xs font-mono text-slate-500">{app.ref || '—'}</span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{fullName}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{app.email || '—'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${getPackageBadge(app.pack_name)}`}>
                                  {app.pack_name || '—'}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${stBadge.cls}`}>
                                  {stBadge.label}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${payBadge.cls}`}>
                                  {payBadge.label}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className="text-xs font-medium text-slate-500">{formatAppDate(app.created_at)}</span>
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
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">Antrag-Details</p>
                <h2 className="text-xl font-bold text-slate-900 truncate">{getFullName(selectedApp)}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-mono text-slate-500">{selectedApp.ref}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getAppStatusBadge(selectedApp.status).cls}`}>
                    {getAppStatusBadge(selectedApp.status).label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPaymentBadge(selectedApp.payment_status).cls}`}>
                    {getPaymentBadge(selectedApp.payment_status).label}
                  </span>
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

            {/* Body - Bento Sections */}
            <div className="p-8 space-y-6">
              {/* Persönliche Daten */}
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">Persönliche Daten</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField label="Vorname" value={selectedApp.first_name} />
                  <DetailField label="Nachname" value={selectedApp.last_name} />
                  <DetailField label="Geburtsdatum" value={selectedApp.birthdate ? formatAppDate(selectedApp.birthdate) : '—'} />
                  <DetailField label="Nationalität" value={selectedApp.nationality} />
                  <DetailField label="Telefon" value={[selectedApp.phone_country_code, selectedApp.phone].filter(Boolean).join(' ')} />
                  <DetailField label="E-Mail" value={selectedApp.email} />
                  <DetailField label="Straße" value={selectedApp.street} />
                  <DetailField label="PLZ / Ort" value={[selectedApp.zip, selectedApp.city].filter(Boolean).join(' ')} />
                  <DetailField label="Land" value={selectedApp.country} />
                  <DetailField label="Wohnsituation" value={selectedApp.housing} />
                </div>
              </div>

              {/* Finanzen */}
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-emerald-50/30 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold mb-4">Finanzen</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField label="Einkommen (netto)" value={formatCurrency(selectedApp.income)} />
                  <DetailField label="Miete" value={formatCurrency(selectedApp.rent)} />
                  <DetailField label="Schulden" value={formatCurrency(selectedApp.debts)} />
                  <DetailField label="Wunschlimit" value={formatCurrency(selectedApp.wanted_limit)} />
                  <DetailField label="Genehmigtes Limit" value={formatCurrency(selectedApp.approved_limit)} />
                  <DetailField label="Beschäftigung" value={selectedApp.employment} />
                  <DetailField label="Arbeitgeber" value={selectedApp.employer} />
                  <DetailField label="Beschäftigt seit" value={selectedApp.employed_since} />
                </div>
              </div>

              {/* Vertragsdaten */}
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-blue-50/30 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-bold mb-4">Vertragsdaten</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
              </div>

              {/* Business (falls vorhanden) */}
              {(selectedApp.company_name || selectedApp.type === 'business') && (
                <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-purple-50/30 p-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-purple-500 font-bold mb-4">Unternehmen</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <DetailField label="Firmenname" value={selectedApp.company_name} />
                    <DetailField label="Rechtsform" value={selectedApp.legal_form} />
                    <DetailField label="Steuer-ID" value={selectedApp.tax_id} />
                    <DetailField label="Gegründet" value={selectedApp.established_year} />
                    <DetailField label="Branche" value={selectedApp.industry} />
                    <DetailField label="Geschäftstyp" value={selectedApp.business_type} />
                    <DetailField label="Jahresumsatz" value={formatCurrency(selectedApp.annual_revenue)} />
                    <DetailField label="Mitarbeiter" value={selectedApp.employees} />
                    <DetailField label="Monatliche Kosten" value={formatCurrency(selectedApp.monthly_expenses)} />
                    <DetailField label="Ansprechpartner" value={selectedApp.contact_name} />
                    <DetailField label="Kontakt-Email" value={selectedApp.contact_email} />
                    <DetailField label="Kontakt-Tel." value={selectedApp.contact_phone} />
                  </div>
                </div>
              )}

              {/* KYC */}
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-rose-50/30 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-rose-500 font-bold mb-4">KYC & Dokumente</p>
                <div className="space-y-3">
                  <KycRow
                    label="Kontoauszug"
                    available={!!selectedApp.bank_statement_pdf || selectedApp.has_bank_statement}
                  />
                  <KycRow
                    label="Ausweisdokument"
                    available={!!selectedApp.id_card_pdf || selectedApp.has_id_card}
                  />
                  <DetailField label="Hochgeladen am" value={selectedApp.documents_uploaded_at ? formatAppDate(selectedApp.documents_uploaded_at) : '—'} />
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <DetailField label="AGB" value={selectedApp.consent_agb ? '✓ Akzeptiert' : '—'} />
                    <DetailField label="SCHUFA" value={selectedApp.consent_schufa ? '✓ Akzeptiert' : '—'} />
                    <DetailField label="Vertrag" value={selectedApp.consent_contract ? '✓ Akzeptiert' : '—'} />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">Meta</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailField label="Typ" value={selectedApp.type} />
                  <DetailField label="Aktueller Step" value={selectedApp.current_step} />
                  <DetailField label="Erstellt" value={formatAppDate(selectedApp.created_at)} />
                  <DetailField label="Aktualisiert" value={formatAppDate(selectedApp.updated_at)} />
                  <DetailField label="Eingereicht" value={selectedApp.submitted_at ? formatAppDate(selectedApp.submitted_at) : '—'} />
                  <DetailField label="Abgeschlossen" value={selectedApp.completed_at ? formatAppDate(selectedApp.completed_at) : '—'} />
                  <div className="col-span-2">
                    <DetailField label="IP-Adresse" value={selectedApp.ip} mono />
                  </div>
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

function DetailField({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">{label}</p>
      <p className={`text-sm font-medium text-slate-800 break-words ${mono ? 'font-mono text-xs' : ''}`}>{display}</p>
    </div>
  );
}

function KycRow({ label, available }: { label: string; available: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${available ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
      </div>
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${available ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
        {available ? 'Vorhanden' : 'Fehlt'}
      </span>
    </div>
  );
}
