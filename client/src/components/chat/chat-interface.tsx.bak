import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { Send, Mic, MicOff, Plus, MessageSquare, X, Menu, Paperclip, File, Image as ImageIcon, FileText, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import arasAiImage from "@assets/ChatGPT Image 9. Apr. 2025_ 21_38_23_1754515368187.png";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

const ANIMATED_TEXTS = [
  "Outbound Calls",
  "Terminvereinbarungen", 
  "Lead Qualifizierung",
  "Gesprächsanalysen",
  "Call Optimierung",
  "Kundengespräche"
];

const SUGGESTED_PROMPTS = [
  "Was ist ARAS AI?",
  "Aktuelle Nachrichten",
  "Vertriebsstrategien"
];

interface UploadedFile { name: string; type: string; size: number; content: string; }
interface OptimisticMessage { id: string; message: string; isAi: boolean; timestamp: Date; isOptimistic: true; }

export function ChatInterface() {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  
  // ✅ NEUER ANSATZ: Wir animieren einfach die LETZTE AI-Message wenn gerade Response kam
  const [shouldAnimateLastAiMessage, setShouldAnimateLastAiMessage] = useState(false);
  const previousMessagesLength = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  useEffect(() => {
    const currentText = ANIMATED_TEXTS[currentTextIndex];
    let charIndex = 0;
    if (isTyping) {
      const typeInterval = setInterval(() => {
        if (charIndex <= currentText.length) {
          setDisplayText(currentText.substring(0, charIndex));
          charIndex++;
        } else {
          setIsTyping(false);
          setTimeout(() => {
            setIsTyping(true);
            setCurrentTextIndex((prev) => (prev + 1) % ANIMATED_TEXTS.length);
          }, 2000);
          clearInterval(typeInterval);
        }
      }, 80);
      return () => clearInterval(typeInterval);
    }
  }, [currentTextIndex, isTyping]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({ queryKey: ["/api/chat/messages"], enabled: !!user && !authLoading, retry: false });
  const { data: chatSessions = [] } = useQuery<any[]>({ queryKey: ["/api/chat/sessions"], enabled: !!user && !authLoading, retry: false });
  const { data: subscriptionData } = useQuery<import("@shared/schema").SubscriptionResponse>({ queryKey: ["/api/user/subscription"], enabled: !!user && !authLoading, retry: false });

  // ✅ KRITISCH: Wenn neue AI-Message hinzukommt, starte Animation!
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.isAi) {
        setShouldAnimateLastAiMessage(true);
        setTimeout(() => setShouldAnimateLastAiMessage(false), 30000);
      }
    }
    previousMessagesLength.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (chatSessions.length > 0) {
      const activeSession = chatSessions.find(s => s.isActive);
      if (activeSession) setCurrentSessionId(activeSession.id);
    }
  }, [chatSessions]);

  const startNewChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chat/sessions/new", { title: `Chat ${new Date().toLocaleTimeString()}` });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      setUploadedFiles([]);
      setOptimisticMessages([]);
      setShouldAnimateLastAiMessage(false);
      previousMessagesLength.current = 0;
      toast({ title: "Neuer Chat gestartet", description: "Vorherige Konversation wurde gespeichert" });
    },
  });


  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const messageData: any = { message, sessionId: currentSessionId };
      if (uploadedFiles.length > 0) {
        messageData.files = uploadedFiles.map(f => ({ name: f.name, content: f.content, type: f.type }));
        messageData.message = `${message}\n\n[WICHTIG: Analysiere die hochgeladenen Dateien: ${uploadedFiles.map(f => f.name).join(', ')}]`;
      }

      setIsStreaming(true);
      setStreamingMessage('');

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';
      let sessionId = currentSessionId;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullMessage += data.content;
                setStreamingMessage(fullMessage);
              }
              if (data.done && data.sessionId) {
                sessionId = data.sessionId;
              }
            } catch (e) {}
          }
        }
      }

      setIsStreaming(false);
      setStreamingMessage('');
      return { sessionId };
    },
    onMutate: async (newMessage) => {
      const optimisticMsg: OptimisticMessage = { id: `optimistic-${Date.now()}`, message: newMessage, isAi: false, timestamp: new Date(), isOptimistic: true };
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
    },
    onSuccess: (data) => {
      setOptimisticMessages([]);
      if (data?.sessionId) setCurrentSessionId(data.sessionId);
      setUploadedFiles([]);
      
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
    },
    onError: () => {
      setOptimisticMessages([]);
      setIsStreaming(false);
      setStreamingMessage('');
      toast({ title: "Fehler", description: "Nachricht konnte nicht gesendet werden", variant: "destructive" });
    },
  });
  const loadChatSession = async (sessionId: string) => {
    try {
      await apiRequest("POST", `/api/chat/sessions/${sessionId}/activate`, {});
      setCurrentSessionId(parseInt(sessionId));
      await queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      setShowHistory(false);
      setOptimisticMessages([]);
      setShouldAnimateLastAiMessage(false);
      previousMessagesLength.current = 0;
      toast({ title: "Chat geladen", description: "Konversation wiederhergestellt" });
    } catch (error) {
      toast({ title: "Fehler", description: "Chat konnte nicht geladen werden", variant: "destructive" });
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Datei zu groß", description: "Maximum 10MB erlaubt", variant: "destructive" });
      return;
    }
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Dateityp nicht unterstützt", description: "Nur PDF, DOCX, TXT und Bilder erlaubt", variant: "destructive" });
      return;
    }
    try {
      let content = '';
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        content = await file.text();
      }
      setUploadedFiles([...uploadedFiles, { name: file.name, type: file.type, size: file.size, content: content }]);
      toast({ title: "Datei hochgeladen", description: `${file.name} wurde hinzugefügt` });
    } catch (error) {
      toast({ title: "Upload-Fehler", description: "Datei konnte nicht gelesen werden", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const removeFile = (index: number) => { setUploadedFiles(uploadedFiles.filter((_, i) => i !== index)); };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || message;
    if ((!messageToSend.trim() && uploadedFiles.length === 0) || sendMessage.isPending) return;
    const userMessage = messageToSend || "Analysiere die hochgeladenen Dateien";
    setMessage("");
    try { await sendMessage.mutateAsync(userMessage); } catch (error) { console.error('Error sending message:', error); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }});
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };
      mediaRecorder.start(250);
      setIsRecording(true);
      setTimeout(() => { if (mediaRecorderRef.current?.state === "recording") stopRecording(); }, 30000);
    } catch (error) {
      toast({ title: "Mikrofon-Fehler", description: "Zugriff verweigert", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const response = await fetch("/api/speech/transcribe", { method: "POST", body: formData, credentials: "include" });
      const data = await response.json();
      if (data.text && data.text.trim()) setMessage(data.text.trim().replace(/\s+/g, ' '));
    } catch (error) {
      toast({ title: "Fehler", description: "Sprache konnte nicht erkannt werden", variant: "destructive" });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, optimisticMessages]);

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const allMessages = [...messages, ...optimisticMessages];
  const hasMessages = allMessages.length > 0;

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <img src={arasLogo} alt="Loading" className="w-12 h-12 object-contain" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] relative overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      {isDragging && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-[#FE9100]/5 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="w-10 h-10 text-[#FE9100] mx-auto mb-2" />
            <p className="text-white text-sm">Datei ablegen</p>
          </div>
        </motion.div>
      )}

      {/* SIDEBAR */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-40" onClick={() => setShowHistory(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 30 }} className="fixed left-0 top-0 bottom-0 w-72 bg-[#0a0a0a] border-r border-white/5 z-50 flex flex-col">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-white font-medium text-sm">Chats</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(false)} className="h-7 w-7 p-0 hover:bg-white/5">
                  <X className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 aras-scroll">
                {chatSessions.length > 0 ? (
                  chatSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      whileHover={{ x: 2 }}
                      onClick={() => loadChatSession(session.id)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        session.isActive ? "bg-white/5 text-white" : "text-gray-500 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="truncate mb-1">{session.title}</div>
                      <div className="text-xs text-gray-600">{new Date(session.updatedAt).toLocaleDateString('de-DE')}</div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-gray-600 text-xs py-12">Keine Chats</div>
                )}
              </div>
              <div className="p-2 border-t border-white/5">
                <Button onClick={() => { startNewChatMutation.mutate(); setShowHistory(false); }} className="w-full bg-white/5 hover:bg-white/10 text-white text-sm h-9">
                  <Plus className="w-4 h-4 mr-2" />
                  Neuer Chat
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => handleFileUpload(e.target.files)} />

      {hasMessages && (
        <div className="p-2 border-b border-white/5 flex justify-between items-center">
          <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} className="text-gray-600 hover:text-white h-8">
            <Menu className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => startNewChatMutation.mutate()} className="text-gray-600 hover:text-white h-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto relative z-10 aras-scroll ${!hasMessages ? 'flex items-center justify-center' : 'p-6 space-y-4'}`}>
        {!hasMessages ? (
          <div className="w-full flex flex-col items-center px-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8 w-full max-w-3xl">
              
              {/* ARAS AI LOGO MIT GRADIENT */}
              <motion.h1 
                className="text-7xl font-bold mb-6 relative"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <span
                  className="relative inline-block"
                  style={{
                    color: '#e9d7c4',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <motion.span
                    className="absolute inset-0"
                    animate={{
                      backgroundImage: [
                        'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                        'linear-gradient(90deg, #FE9100 0%, #a34e00 25%, #e9d7c4 50%, #a34e00 75%, #FE9100 100%)',
                        'linear-gradient(90deg, #a34e00 0%, #e9d7c4 25%, #FE9100 50%, #e9d7c4 75%, #a34e00 100%)',
                        'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                      ],
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    style={{
                      backgroundSize: '300% 100%',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    ARAS AI
                  </motion.span>
                  <span style={{ opacity: 0 }}>ARAS AI</span>
                </span>
              </motion.h1>

              {/* TYPEWRITER EFFEKT */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center space-x-2 text-base text-gray-500 mb-12"
              >
                <span>erledigt für dich:</span>
                <span 
                  className="font-medium min-w-[200px] text-left"
                  style={{
                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                    backgroundSize: '200% auto',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {displayText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-[2px] h-[18px] bg-[#FE9100] ml-1 align-middle"
                  />
                </span>
              </motion.div>

              {/* PROMPT BUTTONS - 3 BUTTONS NEBENEINANDER */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.5 }}
                className="flex justify-center gap-3 mb-12"
              >
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    whileHover={{ 
                      scale: 1.02,
                      backgroundColor: 'rgba(254, 145, 0, 0.05)',
                      borderColor: 'rgba(254, 145, 0, 0.3)'
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-5 py-3 rounded-xl bg-transparent border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>

            {/* EINGABEFELD - ZENTRIERT MIT BUTTONS */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="w-full max-w-3xl">
              {uploadedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/10">
                      <div className="flex items-center space-x-2 text-sm text-white">
                        {getFileIcon(file.type)}
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeFile(index)} className="h-6 w-6 p-0">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end space-x-2">
                <div className="flex-1 relative">
                  {/* FLOWING GRADIENT BORDER */}
                  <div className="absolute -inset-[2px] rounded-3xl">
                    <motion.div
                      className="w-full h-full rounded-3xl"
                      animate={{
                        backgroundImage: [
                          'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                          'linear-gradient(90deg, #FE9100 0%, #a34e00 25%, #e9d7c4 50%, #a34e00 75%, #FE9100 100%)',
                          'linear-gradient(90deg, #a34e00 0%, #e9d7c4 25%, #FE9100 50%, #e9d7c4 75%, #a34e00 100%)',
                          'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                        ],
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      style={{
                        padding: '2px',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                      }}
                    />
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Message ARAS AI"
                    className="relative w-full min-h-[56px] max-h-[200px] bg-[#141414] text-white placeholder:text-gray-600 placeholder:opacity-50 border-0 rounded-3xl px-6 py-4 pr-14 focus:outline-none resize-none"
                    disabled={sendMessage.isPending}
                    rows={1}
                  />

                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-3 w-10 h-10 rounded-full p-0 hover:bg-white/10"
                    disabled={sendMessage.isPending}
                  >
                    {isRecording ? (
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        <MicOff className="w-5 h-5 text-red-400" />
                      </motion.div>
                    ) : (
                      <Mic className="w-5 h-5 text-gray-500" />
                    )}
                  </Button>
                </div>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="ghost"
                  size="sm"
                  className="h-14 w-14 p-0 rounded-2xl hover:bg-white/5"
                >
                  <Paperclip className="w-5 h-5 text-gray-500" />
                </Button>

                <Button
                  onClick={() => handleSendMessage()}
                  size="sm"
                  disabled={!message.trim() || sendMessage.isPending}
                  className="h-14 px-6 bg-white/10 hover:bg-white/15 text-white rounded-2xl disabled:opacity-30"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-700">
                <AlertCircle className="w-3 h-3" />
                <p>ARAS AI ® kann Fehler machen. Bitte verlasse Dich nicht auf jede Ausgabe und überprüfe wichtige Informationen</p>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence>
              {allMessages.map((msg, index) => {
                const isOptimistic = 'isOptimistic' in msg && msg.isOptimistic;
                
                // ✅ KRITISCH: Animiere die LETZTE AI-Message wenn Flag gesetzt ist!
                const lastAiMessage = [...allMessages].reverse().find(m => m.isAi && !('isOptimistic' in m));
                const isNewAiMessage = shouldAnimateLastAiMessage && 
                                       !isOptimistic && 
                                       msg.isAi && 
                                       lastAiMessage && 
                                       msg.id === lastAiMessage.id;
                
                return (
                  <MessageBubble
                    key={isOptimistic ? msg.id : `msg-${msg.id}`}
                    message={msg.message}
                    isAi={msg.isAi || false}
                    timestamp={msg.timestamp ? new Date(msg.timestamp) : new Date()}
                    messageId={msg.id.toString()}
                    onReaction={() => {}}
                    onSpeak={() => {}}
                    isSpeaking={false}
                    isNew={isNewAiMessage}
                  />
                );
              })}
            </AnimatePresence>

            {sendMessage.isPending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
                <img src={arasAiImage} alt="ARAS AI" className="w-8 h-8 rounded-full" />
                <div className="flex space-x-1.5">

            {isStreaming && streamingMessage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-4">
                <img src={arasAiImage} alt="ARAS AI" className="w-8 h-8 rounded-full" />
                <div className="flex-1 bg-white/5 rounded-lg p-4 text-white whitespace-pre-wrap">
                  {streamingMessage}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-[2px] h-[18px] bg-[#FE9100] ml-1 align-middle"
                  />
                </div>
              </motion.div>
            )}
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <motion.div key={i} className="w-2 h-2 bg-[#FE9100] rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay }} />
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="p-4 border-t border-white/5">
          {uploadedFiles.length > 0 && (
            <div className="mb-3 space-y-2 max-w-4xl mx-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/10">
                  <div className="flex items-center space-x-2 text-sm text-white">
                    {getFileIcon(file.type)}
                    <span className="truncate">{file.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeFile(index)} className="h-6 w-6 p-0">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end space-x-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              {/* FLOWING GRADIENT BORDER */}
              <div className="absolute -inset-[2px] rounded-2xl">
                <motion.div
                  className="w-full h-full rounded-2xl"
                  animate={{
                    backgroundImage: [
                      'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                      'linear-gradient(90deg, #FE9100 0%, #a34e00 25%, #e9d7c4 50%, #a34e00 75%, #FE9100 100%)',
                      'linear-gradient(90deg, #a34e00 0%, #e9d7c4 25%, #FE9100 50%, #e9d7c4 75%, #a34e00 100%)',
                      'linear-gradient(90deg, #e9d7c4 0%, #FE9100 25%, #a34e00 50%, #FE9100 75%, #e9d7c4 100%)',
                    ],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  style={{
                    padding: '2px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
              </div>

              <textarea ref={textareaRef} value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyPress} placeholder="Message ARAS AI" className="relative w-full min-h-[48px] max-h-[200px] bg-[#141414] text-white placeholder:text-gray-600 placeholder:opacity-50 border-0 rounded-2xl px-4 py-3 pr-12 focus:outline-none resize-none" disabled={sendMessage.isPending} rows={1} />

              <Button onClick={isRecording ? stopRecording : startRecording} variant="ghost" size="sm" className="absolute right-2 top-2 w-9 h-9 rounded-full p-0 hover:bg-white/10" disabled={sendMessage.isPending}>
                {isRecording ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    <MicOff className="w-4 h-4 text-red-400" />
                  </motion.div>
                ) : (
                  <Mic className="w-4 h-4 text-gray-500" />
                )}
              </Button>
            </div>

            <Button onClick={() => fileInputRef.current?.click()} variant="ghost" size="sm" className="h-12 w-12 p-0 rounded-xl hover:bg-white/5">
              <Paperclip className="w-4 h-4 text-gray-500" />
            </Button>

            <Button onClick={() => handleSendMessage()} size="sm" disabled={!message.trim() || sendMessage.isPending} className="h-12 px-5 bg-white/10 hover:bg-white/15 text-white rounded-xl disabled:opacity-30">
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-2 text-center text-xs text-gray-700">
            <p>ARAS AI ® kann Fehler machen. Bitte verlasse Dich nicht auf jede Ausgabe und überprüfe wichtige Informationen</p>
          </div>
        </div>
      )}

      {isRecording && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-full">
          <div className="flex items-center space-x-2">
            <motion.div className="w-2 h-2 bg-red-500 rounded-full" animate={{ opacity: [1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-sm text-white">Aufnahme...</span>
          </div>
        </motion.div>
      )}

      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        .aras-scroll::-webkit-scrollbar { width: 4px; }
        .aras-scroll::-webkit-scrollbar-track { background: transparent; }
        .aras-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .aras-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}