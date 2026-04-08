import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Phone, Trash2, PlayCircle, Clock } from "lucide-react";

interface Task {
  id: number;
  taskName: string;
  taskPrompt: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
}

export default function VoiceTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/voice/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  const createTask = async () => {
    const res = await fetch("/api/voice/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskName, taskPrompt, phoneNumber })
    });
    
    if (res.ok) {
      setShowCreate(false);
      setTaskName("");
      setTaskPrompt("");
      setPhoneNumber("");
      fetchTasks();
    }
  };

  const executeTask = async (taskId: number) => {
    await fetch(`/api/voice/tasks/${taskId}/execute`, { method: "POST" });
    fetchTasks();
  };

  const deleteTask = async (taskId: number) => {
    await fetch(`/api/voice/tasks/${taskId}`, { method: "DELETE" });
    fetchTasks();
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#fe9100] to-orange-600 bg-clip-text text-transparent">
              ARAS Voice Tasks
            </h1>
            <p className="text-gray-400">Steuere ARAS AI mit eigenen Aufgaben</p>
          </div>
          
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#fe9100] to-orange-600 rounded-xl font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Neue Aufgabe
          </button>
        </div>

        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreate(false)}
          >
            <div 
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-6">Neue ARAS Aufgabe</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Aufgaben-Name</label>
                  <input
                    type="text"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="z.B. Essen verschieben"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl focus:border-[#fe9100] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Telefonnummer</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+41 44 505 4333"
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl focus:border-[#fe9100] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Was soll ARAS sagen?</label>
                  <textarea
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    placeholder="Beispiel: 'Sag der Person, dass das Essen von heute Abend auf morgen 19 Uhr verschoben wird. Frag ob das passt.'"
                    rows={6}
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl focus:border-[#fe9100] focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={createTask}
                    className="flex-1 py-3 bg-gradient-to-r from-[#fe9100] to-orange-600 rounded-xl font-semibold"
                  >
                    Aufgabe erstellen
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-6 py-3 border border-gray-700 rounded-xl"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{task.taskName}</h3>
                  <p className="text-gray-400 mb-4">{task.taskPrompt}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {task.phoneNumber}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(task.createdAt).toLocaleDateString('de-DE')}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      task.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                      task.status === 'executing' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-gray-500/20 text-gray-500'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => executeTask(task.id)}
                    disabled={task.status === 'executing'}
                    className="p-3 bg-[#fe9100]/20 hover:bg-[#fe9100]/30 rounded-xl disabled:opacity-50"
                  >
                    <PlayCircle className="w-5 h-5 text-[#fe9100]" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
