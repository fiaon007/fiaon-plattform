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
  }, []);

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
          </div>
        </div>
      </div>
    </div>
  );
}
