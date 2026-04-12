import { useState, useEffect } from "react";

interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  tags: any[];
  created_at: string;
  updated_at: string;
}

export default function AdminDatabasePage() {
  const [greeting, setGreeting] = useState("");
  const [typedText, setTypedText] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
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
      const res = await fetch('/api/todos');
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

  const toggleTodoStatus = async (todo: Todo) => {
    const newStatus = todo.status === 'done' ? 'pending' : 'done';
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setTodos(todos.map(t => t.id === todo.id ? { ...t, status: newStatus } : t));
      }
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const deleteTodo = async (todoId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTodos(todos.filter(t => t.id !== todoId));
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
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

            {/* TODO List Section */}
            <div className="mb-8">
              <div className="fiaon-glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                  backgroundSize: "200% 200%",
                  animation: "limitGlow 6s ease-in-out infinite"
                }} />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Aufgaben</h2>
                        <p className="text-[13px] text-gray-500">
                          {todos.filter(t => t.status !== 'done').length} offen · {todos.filter(t => t.status === 'done').length} erledigt
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAddTodo(!showAddTodo)}
                      className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white fiaon-btn-gradient transition-all duration-300 hover:scale-105"
                    >
                      + Neue Aufgabe
                    </button>
                  </div>

                  {/* Add Todo Form */}
                  {showAddTodo && (
                    <form onSubmit={addTodo} className="mb-6 animate-[fadeInDown_.3s_ease]">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newTodoTitle}
                          onChange={(e) => setNewTodoTitle(e.target.value)}
                          placeholder="Neue Aufgabe hinzufügen..."
                          className="flex-1 px-4 py-3 rounded-xl bg-white/50 border border-gray-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 outline-none transition-all text-[14px]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-6 py-3 rounded-xl text-[13px] font-semibold text-white fiaon-btn-gradient transition-all duration-300 hover:scale-105"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Todo List */}
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">Laden...</div>
                  ) : todos.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#2563eb]/10 to-[#3b82f6]/10 flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 11l3 3L22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                      </div>
                      <p className="text-[14px] text-gray-500">Keine Aufgaben vorhanden</p>
                      <p className="text-[12px] text-gray-400 mt-1">Füge deine erste Aufgabe hinzu!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todos.map((todo, index) => (
                        <div
                          key={todo.id}
                          className={`group flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                            todo.status === 'done'
                              ? 'bg-gray-50/50 opacity-60'
                              : 'fiaon-glass-panel hover:scale-[1.01]'
                          }`}
                          style={{ animation: `fadeInUp 0.4s ease ${index * 50}ms both` }}
                        >
                          {/* Priority Indicator */}
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(todo.priority)} shrink-0`} />

                          {/* Checkbox */}
                          <button
                            onClick={() => toggleTodoStatus(todo)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                              todo.status === 'done'
                                ? 'bg-[#2563eb] border-[#2563eb]'
                                : 'border-gray-300 hover:border-[#2563eb]'
                            }`}
                          >
                            {todo.status === 'done' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 12 10 16 18 8" />
                              </svg>
                            )}
                          </button>

                          {/* Todo Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[14px] font-medium transition-all duration-300 ${
                              todo.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
                            }`}>
                              {todo.title}
                            </p>
                            {todo.description && (
                              <p className="text-[12px] text-gray-500 mt-0.5">{todo.description}</p>
                            )}
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 transition-all duration-300"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
