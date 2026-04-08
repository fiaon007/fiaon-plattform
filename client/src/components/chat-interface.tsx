import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "./message-bubble";
import { Send, Mic, MicOff, Plus, Trash2, MessageSquare, X, Menu, Paperclip, File, Image as ImageIcon, FileText, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import arasAiImage from "@assets/ChatGPT Image 9. Apr. 2025_ 21_38_23_1754515368187.png";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

const ANIMATED_TEXTS = [
  "Anrufe",
  "Termine vereinbaren",
  "Termine verschieben", 
  "Leads qualifizieren",
  "Kunden anrufen",
  "Verkaufsgespräche",
  "Follow-ups"
];

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string;
}

interface OptimisticMessage {
  id: string;
  message: string;
  isAi: boolean;
  timestamp: Date;
  isOptimistic: true;
}

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
  const [newMessageId, setNewMessageId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Typewriter animation
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

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  const { data: chatSessions = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/sessions"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  const { data: subscriptionData } = useQuery<import("@shared/schema").SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  useEffect(() => {
    if (chatSessions.length > 0) {
      const activeSession = chatSessions.find(s => s.isActive);
      if (activeSession) {
        setCurrentSessionId(activeSession.id);
      }
    }
  }, [chatSessions]);

  const startNewChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chat/sessions/new", {
        title: `Chat ${new Date().toLocaleTimeString()}`
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      setUploadedFiles([]);
      setOptimisticMessages([]);
      toast({
        title: "Neuer Chat gestartet",
        description: "Vorherige Konversation wurde gespeichert",
      });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const messageData: any = { 
        message,
        sessionId: currentSessionId 
      };
      
      if (uploadedFiles.length > 0) {
        messageData.files = uploadedFiles.map(f => ({
          name: f.name,
          content: f.content,
          type: f.type
        }));
        messageData.message = `${message}\n\n[WICHTIG: Analysiere die hochgeladenen Dateien: ${uploadedFiles.map(f => f.name).join(', ')}]`;
      }
      
      const response = await apiRequest("POST", "/api/chat/messages", messageData);
      return response.json();
    },
    onMutate: async (newMessage) => {
      const optimisticMsg: OptimisticMessage = {
        id: `optimistic-${Date.now()}`,
        message: newMessage,
        isAi: false,
        timestamp: new Date(),
        isOptimistic: true
      };
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();
    },
    onSuccess: (data) => {
      setOptimisticMessages([]);
      if (data.sessionId) {
        setCurrentSessionId(data.sessionId);
      }
      if (data.aiMessage && data.aiMessage.id) {
        setNewMessageId(data.aiMessage.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      setUploadedFiles([]);
      setTimeout(() => setNewMessageId(null), 100);
    },
    onError: () => {
      setOptimisticMessages([]);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      });
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
      toast({
        title: "Chat geladen",
        description: "Konversation wiederhergestellt",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Chat konnte nicht geladen werden",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      toast({
        title: "Datei zu groß",
        description: "Maximum 10MB erlaubt",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Dateityp nicht unterstützt",
        description: "Nur PDF, DOCX, TXT und Bilder erlaubt",
        variant: "destructive",
      });
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
      
      setUploadedFiles([...uploadedFiles, {
        name: file.name,
        type: file.type,
        size: file.size,
        content: content
      }]);

      toast({
        title: "Datei hochgeladen",
        description: `${file.name} wurde hinzugefügt`,
      });
    } catch (error) {
      toast({
        title: "Upload-Fehler",
        description: "Datei konnte nicht gelesen werden",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && uploadedFiles.length === 0) || sendMessage.isPending) return;
    const userMessage = message || "Analysiere die hochgeladenen Dateien";
    setMessage("");
    try {
      await sendMessage.mutateAsync(userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start(250);
      setIsRecording(true);
      
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") stopRecording();
      }, 30000);
      
    } catch (error) {
      toast({
        title: "Mikrofon-Fehler",
        description: "Zugriff verweigert",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json();
      if (data.text && data.text.trim()) {
        setMessage(data.text.trim().replace(/\s+/g, ' '));
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Sprache konnte nicht erkannt werden",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, optimisticMessages]);

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const allMessages = [...messages, ...optimisticMessages];

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <img src={arasLogo} alt="Loading" className="w-12 h-12 object-contain" />
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 bg-[#FE9100]/20 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-[#FE9100]"
        >
          <div className="text-center">
            <Paperclip className="w-16 h-16 text-[#FE9100] mx-auto mb-4" />
            <p className="text-white text-xl font-semibold">Datei hier ablegen</p>
          </div>
        </motion.div>
      )}

      {/* Chat History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowHistory(false)}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-xl border-r border-white/10 z-50 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-[#FE9100]" />
                  <h3 className="text-white font-semibold">Chat-Historie</h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2 premium-scroll">
                {chatSessions.length > 0 ? (
                  chatSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 4 }}
                      onClick={() => loadChatSession(session.id)}
                      className={`group p-3 rounded-xl cursor-pointer transition-all ${
                        session.isActive
                          ? "bg-[#FE9100]/10 border border-[#FE9100]/30"
                          : "bg-white/5 hover:bg-white/10 border border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <MessageSquare className={`w-4 h-4 ${session.isActive ? 'text-[#FE9100]' : 'text-gray-400'}`} />
                          <div className="text-sm font-medium text-white truncate">
                            {session.title}
                          </div>
                        </div>
                        {session.isActive && (
                          <div className="w-2 h-2 bg-[#FE9100] rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(session.updatedAt).toLocaleDateString('de-DE', { 
                            day: '2-digit', 
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 text-center py-12">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Keine Chat-Historie</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 border-t border-white/10">
                <Button
                  onClick={() => {
                    startNewChatMutation.mutate();
                    setShowHistory(false);
                  }}
                  className="w-full bg-gradient-to-r from-[#FE9100] to-[#a34e00] hover:from-[#ff9d1a] hover:to-[#b55a00] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Neuer Chat
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {allMessages.length === 0 ? (
        /* WELCOME SCREEN */
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <img src={arasLogo} alt="ARAS AI" className="w-20 h-20 object-contain" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              ARAS AI
            </h1>
            <div className="flex items-center justify-center space-x-3 text-2xl text-gray-400">
              <span>erledigt:</span>
              <motion.span className="text-[#FE9100] font-semibold min-w-[240px] text-left">
                {displayText}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-[3px] h-[28px] bg-[#FE9100] ml-1"
                />
              </motion.span>
            </div>
          </motion.div>

          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl mb-6"
            >
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file.type)}
                      <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                      <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-3xl"
          >
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Was möchtest du wissen?"
                className="w-full h-14 bg-white/5 backdrop-blur-sm text-white placeholder:text-gray-500 border border-white/10 rounded-2xl px-6 pr-40 text-base focus:border-[#FE9100]/50 transition-all"
                disabled={sendMessage.isPending}
              />
              
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  disabled={sendMessage.isPending}
                >
                  <Paperclip className="w-4 h-4 text-gray-400" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  disabled={sendMessage.isPending}
                >
                  {isRecording ? (
                    <MicOff className="w-4 h-4 text-red-400" />
                  ) : (
                    <Mic className="w-4 h-4 text-gray-400" />
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  disabled={(!message.trim() && uploadedFiles.length === 0) || sendMessage.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-[#FE9100] to-[#a34e00] hover:from-[#ff9d1a] hover:to-[#b55a00] disabled:from-gray-700 disabled:to-gray-800 rounded-xl text-white font-medium transition-all"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
            
            {subscriptionData && (
              <div className="text-center mt-3 text-xs text-gray-600">
                {subscriptionData.aiMessagesUsed} / {subscriptionData.aiMessagesLimit || '∞'} Nachrichten
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        /* CHAT VIEW */
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center backdrop-blur-sm bg-black/50">
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHistory(true)}
                className="text-gray-400 hover:text-white h-9 w-9 p-0"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <img src={arasLogo} alt="ARAS" className="w-7 h-7 object-contain" />
              <span className="text-white font-semibold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                ARAS AI
              </span>
            </div>
            
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => startNewChatMutation.mutate()}
              className="text-gray-400 hover:text-white h-9 px-3"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neuer Chat
            </Button>
          </div>

          {/* Messages - Centered with max-width */}
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-20 premium-scroll">
            <div className="max-w-4xl mx-auto">
              <AnimatePresence>
                {allMessages.map((msg, index) => {
                  const isOptimistic = 'isOptimistic' in msg && msg.isOptimistic;
                  const isNewAiMessage = !!(!isOptimistic && msg.isAi && msg.id === newMessageId);
                  
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start mb-6"
                >
                  <div className="flex items-center space-x-3">
                    <img src={arasAiImage} alt="ARAS AI" className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FE9100]/20" />
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3.5">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          {[0, 0.2, 0.4].map((delay, i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-[#FE9100] rounded-full"
                              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity, delay }}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-400">denkt nach...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area - Centered with max-width */}
          <div className="border-t border-white/10 bg-black/80 backdrop-blur-xl pb-8">
            {uploadedFiles.length > 0 && (
              <div className="px-6 pt-4">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2 space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(file.type)}
                          <span className="text-xs text-white truncate max-w-[300px]">{file.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile(index)}
                          className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pt-8 pb-12">
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="relative">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nachricht an ARAS AI..."
                    className="w-full h-14 bg-white/5 backdrop-blur-sm text-white placeholder:text-gray-500 border border-white/10 rounded-2xl px-6 pr-40 text-base focus:border-[#FE9100]/50 transition-all"
                    disabled={sendMessage.isPending}
                  />
                  
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                      disabled={sendMessage.isPending}
                    >
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                      disabled={sendMessage.isPending}
                    >
                      {isRecording ? (
                        <MicOff className="w-4 h-4 text-red-400" />
                      ) : (
                        <Mic className="w-4 h-4 text-gray-400" />
                      )}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSendMessage}
                      disabled={(!message.trim() && uploadedFiles.length === 0) || sendMessage.isPending}
                      className="px-4 py-2 bg-gradient-to-r from-[#FE9100] to-[#a34e00] hover:from-[#ff9d1a] hover:to-[#b55a00] disabled:from-gray-700 disabled:to-gray-800 rounded-xl text-white font-medium transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
                
                {/* Disclaimer Text */}
                <div className="text-center px-4 pt-3 pb-2">
                  <p className="text-sm text-gray-400 leading-relaxed font-medium">
                    ARAS AI kann Fehler machen. Überprüfe wichtige Informationen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      
      <style>{`
        .premium-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .premium-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .premium-scroll::-webkit-scrollbar-thumb {
          background: rgba(254, 145, 0, 0.2);
          border-radius: 10px;
        }
        .premium-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(254, 145, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
