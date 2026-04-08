import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { Send, Mic, MicOff, Plus, MessageSquare, X, Menu, Paperclip, File, Image as ImageIcon, FileText, Clock, AlertCircle, Phone, Loader2, ArrowUp, Sparkles, Zap, ChevronRight, LayoutGrid, FileEdit, PhoneCall, Users, User, Briefcase, UtensilsCrossed, Calendar, MessageCircle, Copy, CheckCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";

// SAFE HELPERS (prevent crashes from null/undefined)
const safeArray = <T,>(x: T[] | null | undefined): T[] => Array.isArray(x) ? x : [];
const safeJson = async (res: Response): Promise<any> => {
  try { return await res.json(); } catch { return {}; }
};
import arasAiImage from "@assets/ChatGPT Image 9. Apr. 2025_ 21_38_23_1754515368187.png";
import arasLogo from "@/assets/aras_logo_1755067745303.png";
import { SpaceConversionTips } from "@/components/space/SpaceConversionTips";
import { SpaceKnowledgeBanner } from "@/components/space/SpaceKnowledgeBanner";
import { SpaceCalendarBanner } from "@/components/space/SpaceCalendarBanner";
import { SpaceMatrixIntel } from "@/components/space/SpaceMatrixIntel";
import HowArasThinksDeck from "@/components/space/HowArasThinksDeck";
import { SpaceDailyNews } from "@/components/space/SpaceDailyNews";

const ANIMATED_TEXTS = [
  "Outbound Calls",
  "Terminvereinbarungen", 
  "Lead Qualifizierung",
  "Gesprächsanalysen",
  "Call Optimierung",
  "Kundengespräche"
];

const SUGGESTED_PROMPTS = [
  { 
    text: "Outbound Kampagne starten", 
    subtext: "Grid öffnen (10.000 parallel)",
    icon: "grid",
    action: "navigate",
    href: "/app/campaigns"
  },
  { 
    text: "Einzelanruf starten", 
    subtext: "Direkter Anruf",
    icon: "call",
    action: "navigate",
    href: "/app/power"
  },
  { 
    text: "ARAS AI prompt schreiben", 
    subtext: "KI-Instruktion erstellen",
    icon: "edit",
    action: "create_prompt",
    href: null
  }
];

const CALL_TEMPLATES = [
  { 
    icon: "📅", 
    title: "Termin", 
    message: "Ich möchte einen Termin für nächste Woche vereinbaren. Bitte finden Sie einen passenden Zeitpunkt." 
  },
  { 
    icon: "📞", 
    title: "Rückruf", 
    message: "Bitte rufen Sie mich zurück, um Details zu besprechen. Ich bin heute zwischen 14-18 Uhr erreichbar." 
  },
  { 
    icon: "💼", 
    title: "Business", 
    message: "Ich interessiere mich für Ihre Dienstleistungen und würde gerne mehr über Ihre Angebote erfahren." 
  },
  { 
    icon: "✨", 
    title: "Custom", 
    message: "" 
  }
];

// 🔥 NEUE EINZELANRUF USE CASES
const EINZELANRUF_USE_CASES = [
  {
    id: 'bewerber',
    icon: Briefcase,
    title: 'Bewerber prüfen',
    description: 'Kandidaten vorqualifizieren',
    promptHint: 'Bewerber-Screening für eine Stelle'
  },
  {
    id: 'tisch',
    icon: UtensilsCrossed,
    title: 'Tisch reservieren',
    description: 'Restaurant-Reservierung',
    promptHint: 'Tischreservierung in einem Restaurant'
  },
  {
    id: 'meeting',
    icon: Calendar,
    title: 'Meeting bestätigen',
    description: 'Termin verifizieren',
    promptHint: 'Meeting-Bestätigung mit einem Kontakt'
  }
];

interface UploadedFile { name: string; type: string; size: number; content: string; }
interface OptimisticMessage { id: string; message: string; isAi: boolean; timestamp: Date; isOptimistic: true; }

const THINKING_PHASES = [
  'Analysiert deine Anfrage',
  'Recherchiert im Internet',
  'Verarbeitet Informationen',
  'Erstellt Antwort',
];

function ThinkingPhaseIndicator() {
  const [phase, setPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => (prev + 1) % THINKING_PHASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
    >
      <span className="text-sm font-medium text-gray-300">{THINKING_PHASES[phase]}</span>
    </motion.div>
  );
}

export function ChatInterface() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callFormData, setCallFormData] = useState({ contactName: '', phoneNumber: '', message: '' });
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  
  // 🔥 CALL WIZARD STATE
  const [callWizardStep, setCallWizardStep] = useState<'type' | 'usecase' | 'input' | 'generating' | 'result'>('type');
  const [selectedCallType, setSelectedCallType] = useState<'einzelanruf' | 'kampagne' | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [wizardMessages, setWizardMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  
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

  // 🔥 USER PROFILE CONTEXT FOR PERSONALIZED INSTRUCTION GENERATION
  const { data: profileContext } = useQuery({
    queryKey: ['profile-context'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile-context', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !authLoading,
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
          }, 1600);
          clearInterval(typeInterval);
        }
      }, 45);
      return () => clearInterval(typeInterval);
    }
  }, [currentTextIndex, isTyping]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({ 
    queryKey: ["/api/chat/messages"], 
    enabled: !!user && !authLoading, 
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch('/api/chat/messages', { credentials: 'include' });
        const data = await safeJson(res);
        // Handle new { success, messages } shape or legacy array
        return safeArray(data.messages ?? data);
      } catch (err) {
        console.error('[Chat] Failed to fetch messages:', err);
        return [];
      }
    }
  });

  // Auto-scroll to bottom when new messages arrive
  // FIX: Only scroll if we actually have messages (prevents scroll-jump on empty state)
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, isStreaming]);
  const { data: chatSessions = [] } = useQuery<any[]>({ 
    queryKey: ["/api/chat/sessions"], 
    enabled: !!user && !authLoading, 
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch('/api/user/chat-sessions', { credentials: 'include' });
        const data = await safeJson(res);
        // Handle new { success, sessions } shape or legacy array
        return safeArray(data.sessions ?? data);
      } catch (err) {
        console.error('[Chat] Failed to fetch sessions:', err);
        return [];
      }
    }
  });
  const { data: subscriptionData } = useQuery<import("@shared/schema").SubscriptionResponse>({ queryKey: ["/api/user/subscription"], enabled: !!user && !authLoading, retry: false });

  useEffect(() => {
    if (chatSessions.length > 0) {
      const activeSession = chatSessions.find(s => s.isActive);
      if (activeSession) setCurrentSessionId(activeSession.id);
    }
  }, [chatSessions]);

  // Helper function to generate chat title from message
  const generateChatTitle = (message: string): string => {
    // Remove file upload hints
    const cleanMessage = message.replace(/\[WICHTIG:.*?\]/g, '').trim();
    // Take first 40 characters and add ellipsis if needed
    const maxLength = 40;
    if (cleanMessage.length <= maxLength) {
      return cleanMessage;
    }
    return cleanMessage.substring(0, maxLength).trim() + '...';
  };

  const startNewChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chat/sessions/new", { title: "Neuer Chat" });
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

      setIsThinking(true);
      setIsStreaming(false);
      setStreamingMessage('');

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || 'Limit reached';
          
          toast({
            title: "Limit erreicht! ❌",
            description: errorMessage,
            variant: "destructive",
            duration: 15000,
            action: (
              <ToastAction 
                altText="Jetzt upgraden" 
                onClick={() => window.location.href = '/billing'}
              >
                Jetzt upgraden 🚀
              </ToastAction>
            )
          });
          
          setIsStreaming(false);
          setStreamingMessage('');
          setOptimisticMessages([]);
          return null;
        }
        console.error('[ChatInterface] Failed to send message');
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';
      let sessionId = currentSessionId;
      let hasStartedStreaming = false;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.thinking) {
                setIsThinking(true);
                continue;
              }
              
              if (data.error) {
                setIsThinking(false);
                setIsStreaming(false);
                setStreamingMessage('');
                toast({
                  title: "ARAS AI Antwort",
                  description: data.error,
                  variant: "default",
                });
                console.error('[ChatInterface] Stream error:', data.error);
                return null;
              }
              
              if (data.sessionId && !currentSessionId) {
                sessionId = data.sessionId;
                setCurrentSessionId(data.sessionId);
                
                // Update session title with first message
                const title = generateChatTitle(message);
                fetch('/api/chat/sessions/update-title', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ sessionId: data.sessionId, title })
                }).catch(err => console.error('Failed to update title:', err));
              }
              
              if (data.content) {
                if (!hasStartedStreaming) {
                  hasStartedStreaming = true;
                  setIsThinking(false);
                  setIsStreaming(true);
                }
                
                fullMessage += data.content;
                setStreamingMessage(fullMessage);
              }
            } catch (error) {
              console.error('[ChatInterface] Parse error:', error);
            }
          }
        }
      }

      setIsThinking(false);
      setIsStreaming(false);
      
      setShouldAnimateLastAiMessage(true);
      setTimeout(() => setShouldAnimateLastAiMessage(false), 30000);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const userId = user && typeof user === 'object' && 'id' in user ? (user as any).id : null;
      if (fullMessage && sessionId && userId) {
        const currentMessages = queryClient.getQueryData<any[]>(["/api/chat/messages"]) || [];
        
        const updatedMessages = [
          ...currentMessages,
          {
            id: Date.now(),
            sessionId,
            userId,
            message: messageData.message,
            isAi: false,
            timestamp: new Date().toISOString()
          },
          {
            id: Date.now() + 1,
            sessionId,
            userId,
            message: fullMessage,
            isAi: true,
            timestamp: new Date().toISOString()
          }
        ];
        
        queryClient.setQueryData(["/api/chat/messages"], updatedMessages);
      }
      
      setStreamingMessage('');
      setOptimisticMessages([]);
      
      return { sessionId };
    },
    onMutate: async (newMessage) => {
      const optimisticMsg: OptimisticMessage = { id: `optimistic-${Date.now()}`, message: newMessage, isAi: false, timestamp: new Date(), isOptimistic: true };
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
    },
    onSuccess: (data) => {
      if (data?.sessionId) setCurrentSessionId(data.sessionId);
      setUploadedFiles([]);
      
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      setOptimisticMessages([]);
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingMessage('');
      setIsSyncing(false);
      
      if (!error.message.includes('Limit') && !error.message.includes('limit')) {
        toast({ title: "Fehler", description: "Nachricht konnte nicht gesendet werden", variant: "destructive" });
      }
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
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    try { 
      await sendMessage.mutateAsync(userMessage); 
    } catch (error) { 
      console.error('Error sending message:', error); 
    }
  };

  // 🔥 START PROMPT CREATION FLOW - Hidden system message, only ARAS response visible
  const startPromptCreation = async () => {
    const userName = profileContext?.name || (user as any)?.firstName || (user as any)?.name || 'du';
    const companyName = profileContext?.company || '';
    const industry = profileContext?.industry || '';
    
    // Show loading state immediately
    setIsPromptLoading(true);
    
    // HIDDEN system prompt - User will NOT see this, only ARAS's response
    const hiddenSystemPrompt = `[PROMPT-ERSTELLUNG STARTEN]
Du bist ARAS AI, ein intelligenter Assistent für Telefonie-Automatisierung. 
Der User "${userName}"${companyName ? ` von "${companyName}"` : ''}${industry ? ` (Branche: ${industry})` : ''} möchte einen Prompt für einen KI-Telefonagenten erstellen.

WICHTIG: Antworte NUR mit dieser freundlichen Frage (ohne Erwähnung von Gemini, ChatGPT oder anderen KI-Namen - du bist ARAS AI):

"Hi ${userName}! 👋 Klar, ich erstelle dir den perfekten Prompt für dein Telefonat.

**Handelt es sich um einen Einzelanruf oder eine Kampagne?**

🔹 **Einzelanruf** – Ein einzelnes Telefonat mit einer Person
🔹 **Kampagne** – bis zu 10.000 Calls gleichzeitig!

Klicke einfach auf eine Option!"

Das ist ALLES was du antworten sollst - keine zusätzlichen Erklärungen.`;

    // Send hidden message and show only AI response
    setIsThinking(true);
    setIsStreaming(true);
    setStreamingMessage('');
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: hiddenSystemPrompt,
          hideUserMessage: true // Flag to not save user message visibly
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start prompt creation');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullMessage += parsed.content;
                  setStreamingMessage(fullMessage);
                }
              } catch {}
            }
          }
        }
      }

      setIsThinking(false);
      setIsStreaming(false);
      setStreamingMessage('');
      setIsPromptLoading(false);
      
      // Refresh messages to show the AI response
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      
    } catch (error) {
      console.error('Error starting prompt creation:', error);
      setIsThinking(false);
      setIsStreaming(false);
      setStreamingMessage('');
      setIsPromptLoading(false);
      toast({
        title: "Fehler",
        description: "Prompt-Erstellung konnte nicht gestartet werden",
        variant: "destructive"
      });
    }
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

  // FIX: Only scroll to bottom if we have messages (prevents scroll-jump on initial load)
  useEffect(() => {
    if (messages.length > 0 || optimisticMessages.length > 0) {
      scrollToBottom();
    }
  }, [messages, optimisticMessages, streamingMessage, isThinking]);

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // 🔥 CALL WIZARD FUNCTIONS
  const resetCallWizard = () => {
    setCallWizardStep('type');
    setSelectedCallType(null);
    setSelectedUseCase(null);
    setCustomInput('');
    setGeneratedPrompt('');
    setPromptCopied(false);
    setWizardMessages([]);
    setIsGeneratingPrompt(false);
  };

  const generateCallPrompt = async (useCase: string | null, customText: string) => {
    setIsGeneratingPrompt(true);
    setCallWizardStep('generating');
    
    try {
      const useCaseInfo = useCase ? EINZELANRUF_USE_CASES.find(u => u.id === useCase) : null;
      const context = useCaseInfo 
        ? `Anwendungsfall: ${useCaseInfo.title} - ${useCaseInfo.promptHint}`
        : 'Benutzerdefinierter Anruf';
      
      const userInput = customText || (useCaseInfo?.promptHint || '');
      
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `Du bist ein Experte für KI-Telefonanrufe. Erstelle einen präzisen, professionellen Prompt für einen ARAS AI Einzelanruf.

Kontext: ${context}
Benutzerangabe: ${userInput}

WICHTIG: Erstelle einen klaren, strukturierten Prompt der folgendes enthält:
1. Ziel des Anrufs (1-2 Sätze)
2. Wichtige Punkte die angesprochen werden sollen
3. Gewünschter Ton (professionell, freundlich, etc.)

Formatiere den Prompt so, dass er direkt für einen KI-Telefonanruf verwendet werden kann. Halte ihn kurz und prägnant (max. 150 Wörter).
Antworte NUR mit dem Prompt selbst, ohne Einleitung oder Erklärung.`,
          sessionId: null
        })
      });

      if (!response.ok) throw new Error('Prompt generation failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullPrompt = '';

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
                fullPrompt += data.content;
                setGeneratedPrompt(fullPrompt);
              }
            } catch (e) {}
          }
        }
      }

      setCallWizardStep('result');
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Prompt konnte nicht generiert werden',
        variant: 'destructive'
      });
      setCallWizardStep('input');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const copyPromptAndRedirect = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setPromptCopied(true);
      
      // Store prompt in localStorage for POWER page
      localStorage.setItem('aras_prefilled_prompt', generatedPrompt);
      
      toast({
        title: 'Prompt kopiert! ✓',
        description: 'Weiterleitung zur Power-Seite...',
      });
      
      // Redirect to POWER page after short delay
      setTimeout(() => {
        setShowCallModal(false);
        resetCallWizard();
        setLocation('/app/power');
      }, 1000);
    } catch (error) {
      toast({
        title: 'Kopieren fehlgeschlagen',
        description: 'Bitte manuell kopieren',
        variant: 'destructive'
      });
    }
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
    <div className="flex flex-col h-full bg-black/30 relative overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      {isDragging && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-[#FE9100]/5 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="w-10 h-10 text-[#FE9100] mx-auto mb-2" />
            <p className="text-white text-sm">Datei ablegen</p>
          </div>
        </motion.div>
      )}

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
          <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} className="h-8 p-0 w-8 hover:bg-white/5">
            <motion.div
              animate={{
                backgroundImage: [
                  'linear-gradient(90deg, #FE9100 0%, #ffd700 50%, #ffffff 100%)',
                  'linear-gradient(90deg, #ffd700 0%, #ffffff 50%, #FE9100 100%)',
                  'linear-gradient(90deg, #ffffff 0%, #FE9100 50%, #ffd700 100%)',
                  'linear-gradient(90deg, #FE9100 0%, #ffd700 50%, #ffffff 100%)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              <Menu className="w-4 h-4" />
            </motion.div>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => startNewChatMutation.mutate()} className="h-8 p-0 w-8 hover:bg-white/5">
            <motion.div
              animate={{
                backgroundImage: [
                  'linear-gradient(90deg, #FE9100 0%, #ffd700 50%, #ffffff 100%)',
                  'linear-gradient(90deg, #ffd700 0%, #ffffff 50%, #FE9100 100%)',
                  'linear-gradient(90deg, #ffffff 0%, #FE9100 50%, #ffd700 100%)',
                  'linear-gradient(90deg, #FE9100 0%, #ffd700 50%, #ffffff 100%)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              <Plus className="w-4 h-4" />
            </motion.div>
          </Button>
        </div>
      )}

      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto relative z-10 aras-scroll ${!hasMessages ? 'px-3 sm:px-6 pt-8 pb-32' : 'px-3 sm:px-6 pt-4 pb-32 sm:pb-24 space-y-4'}`}>
        {!hasMessages ? (
          <div className="w-full flex flex-col items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8 w-full max-w-3xl">
              
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-12 flex items-center justify-center gap-3 text-xs"
              >
                <div className="px-3 py-1.5 rounded-lg" style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span className="text-gray-600">
                    {currentTime.toLocaleDateString('de-CH', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Europe/Zurich'
                    })}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg font-mono" style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontFamily: 'monospace'
                }}>
                  <span className="text-gray-600">
                    {currentTime.toLocaleTimeString('de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZone: 'Europe/Zurich'
                    })}
                  </span>
                </div>
              </motion.div>

              <motion.h1 
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 relative"
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

              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:space-x-2 text-sm sm:text-base text-gray-500 mb-8 sm:mb-12"
              >
                <span>erledigt für dich:</span>
                <span 
                  className="font-medium min-w-[160px] sm:min-w-[200px] text-center sm:text-left"
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

              {/* Premium Quick Action Buttons - Ultra High-End Design */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.5 }}
                className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-3 w-full max-w-4xl"
              >
                {SUGGESTED_PROMPTS.map((prompt, index) => {
                  const isThisButtonLoading = prompt.action === 'create_prompt' && isPromptLoading;
                  
                  const handleClick = () => {
                    if (isThisButtonLoading) return; // Prevent double-click
                    
                    if (prompt.action === 'navigate' && prompt.href) {
                      setLocation(prompt.href);
                    } else if (prompt.action === 'call') {
                      setShowCallModal(true);
                    } else if (prompt.action === 'create_prompt') {
                      // 🔥 START PROMPT CREATION FLOW IN CHAT
                      startPromptCreation();
                    } else if (prompt.action === 'coming_soon') {
                      toast({
                        title: "Demnächst verfügbar",
                        description: "Diese Funktion wird bald freigeschaltet.",
                      });
                    }
                  };

                  const getIcon = () => {
                    // Show loading spinner for prompt creation button
                    if (isThisButtonLoading) {
                      return (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Loader2 className="w-5 h-5" />
                        </motion.div>
                      );
                    }
                    
                    switch (prompt.icon) {
                      case 'grid':
                        return <LayoutGrid className="w-5 h-5" />;
                      case 'edit':
                        return <FileEdit className="w-5 h-5" />;
                      case 'call':
                        return <PhoneCall className="w-5 h-5" />;
                      default:
                        return <Sparkles className="w-5 h-5" />;
                    }
                  };

                  return (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        delay: 0.6 + index * 0.15,
                        type: "spring",
                        stiffness: 200,
                        damping: 20
                      }}
                      whileHover={{ 
                        scale: 1.02, 
                        y: -4,
                        boxShadow: '0 0 40px rgba(254, 145, 0, 0.4), 0 0 80px rgba(254, 145, 0, 0.2)',
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClick}
                      className="group relative px-6 py-4 rounded-2xl text-white flex items-center gap-4 transition-all duration-300 w-full sm:w-auto min-w-[260px] overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.9) 0%, rgba(10, 10, 10, 0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      {/* Animated Border Gradient */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          padding: '1.5px',
                          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.6), rgba(233, 215, 196, 0.3), rgba(254, 145, 0, 0.6))',
                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          WebkitMaskComposite: 'xor',
                          maskComposite: 'exclude',
                        }}
                        animate={{
                          background: [
                            'linear-gradient(135deg, rgba(254, 145, 0, 0.6), rgba(233, 215, 196, 0.3), rgba(254, 145, 0, 0.6))',
                            'linear-gradient(225deg, rgba(233, 215, 196, 0.4), rgba(254, 145, 0, 0.6), rgba(233, 215, 196, 0.3))',
                            'linear-gradient(315deg, rgba(254, 145, 0, 0.6), rgba(233, 215, 196, 0.3), rgba(254, 145, 0, 0.6))',
                            'linear-gradient(135deg, rgba(254, 145, 0, 0.6), rgba(233, 215, 196, 0.3), rgba(254, 145, 0, 0.6))',
                          ],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      />

                      {/* Glow Effect on Hover */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: 'radial-gradient(ellipse at center, rgba(254, 145, 0, 0.15) 0%, transparent 70%)',
                        }}
                      />

                      {/* Icon Container with Gradient */}
                      <motion.div 
                        className="relative flex items-center justify-center w-12 h-12 rounded-xl"
                        style={{
                          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2) 0%, rgba(254, 145, 0, 0.05) 100%)',
                          border: '1px solid rgba(254, 145, 0, 0.3)',
                        }}
                        whileHover={{
                          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.3) 0%, rgba(254, 145, 0, 0.1) 100%)',
                        }}
                      >
                        <motion.div
                          animate={{
                            color: ['#FE9100', '#e9d7c4', '#FE9100'],
                          }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {getIcon()}
                        </motion.div>
                      </motion.div>

                      {/* Text Content */}
                      <div className="relative flex flex-col items-start text-left flex-1">
                        <span 
                          className="text-sm font-bold tracking-wide"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            background: 'linear-gradient(90deg, #ffffff, #e9d7c4)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          {prompt.text}
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5 font-medium">
                          {prompt.subtext}
                        </span>
                      </div>

                      {/* Arrow Indicator */}
                      <motion.div
                        className="relative"
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <ChevronRight className="w-5 h-5 text-[#FE9100] opacity-60 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>

            {/* CONVERSION TIPS - Ersetzt Input-Feld */}
            <SpaceConversionTips />

            {/* WISSENSDATENBANK BANNER - Link to /app/leads */}
            <SpaceKnowledgeBanner />

            {/* KALENDER BANNER - Link to /app/calendar + Live Next Event */}
            <SpaceCalendarBanner />

            {/* DAILY INDUSTRY NEWS - AI-curated news for user's industry */}
            <SpaceDailyNews />

            {/* HOW ARAS THINKS - Transparent Glass Operator Deck */}
            <HowArasThinksDeck />

            {/* MATRIX COMMAND DECK - ARAS Background Operations */}
            <SpaceMatrixIntel />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence initial={false}>
              {allMessages.map((msg, index) => {
                const isOptimistic = 'isOptimistic' in msg && msg.isOptimistic;
                const lastAiMessage = [...allMessages].reverse().find(m => m.isAi && !('isOptimistic' in m));
                const isNewAiMessage = shouldAnimateLastAiMessage && !isOptimistic && msg.isAi && lastAiMessage && msg.id === lastAiMessage.id;
                
                return (
                  <motion.div
                    key={isOptimistic ? msg.id : `msg-${msg.id}`}
                    initial={false}
                    animate={{ opacity: 1 }}
                  >
                    <MessageBubble
                      message={msg.message}
                      isAi={msg.isAi || false}
                      timestamp={msg.timestamp ? new Date(msg.timestamp) : new Date()}
                      messageId={msg.id.toString()}
                      onReaction={() => {}}
                      onSpeak={() => {}}
                      isSpeaking={false}
                      isNew={!!isNewAiMessage}
                      onOptionClick={async (option) => {
                        // Handle special redirect commands
                        if (option === '__REDIRECT_POWER__') {
                          setLocation('/app/power');
                          return;
                        }
                        if (option === '__REDIRECT_CAMPAIGNS__') {
                          setLocation('/app/campaigns');
                          return;
                        }
                        
                        // Handle Einzelanruf selection - send hidden prompt for use case question
                        if (option === 'Einzelanruf') {
                          setIsThinking(true);
                          setIsStreaming(true);
                          setStreamingMessage('');
                          
                          const userName = profileContext?.name || (user as any)?.firstName || 'du';
                          const hiddenPrompt = `[EINZELANRUF-MODUS]
Der User hat "Einzelanruf" gewählt. Du MUSST jetzt EXAKT diese Antwort geben:

"Super, ${userName}! 👍 Einzelanruf also.

**Was soll dieser Anruf bewirken?**

Wähle einen häufigen Anwendungsfall oder beschreibe deinen eigenen:"

Das ist ALLES. Keine weiteren Erklärungen. Die Buttons werden automatisch angezeigt.`;
                          
                          try {
                            const response = await fetch('/api/chat/messages', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ message: hiddenPrompt, hideUserMessage: true }),
                            });
                            
                            const reader = response.body?.getReader();
                            const decoder = new TextDecoder();
                            let fullMessage = '';
                            
                            if (reader) {
                              while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                const chunk = decoder.decode(value, { stream: true });
                                for (const line of chunk.split('\n')) {
                                  if (line.startsWith('data: ')) {
                                    try {
                                      const parsed = JSON.parse(line.slice(6));
                                      if (parsed.content) {
                                        fullMessage += parsed.content;
                                        setStreamingMessage(fullMessage);
                                      }
                                    } catch {}
                                  }
                                }
                              }
                            }
                            
                            setIsThinking(false);
                            setIsStreaming(false);
                            setStreamingMessage('');
                            queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
                          } catch (error) {
                            setIsThinking(false);
                            setIsStreaming(false);
                          }
                          return;
                        }
                        
                        // Handle USE CASE selections - send hidden prompt to generate prompt IMMEDIATELY
                        if (option.includes('Bewerber') || option.includes('Tisch') || option.includes('Meeting')) {
                          setIsThinking(true);
                          setIsStreaming(true);
                          setStreamingMessage('');
                          
                          const userName = profileContext?.name || (user as any)?.firstName || 'du';
                          const companyName = profileContext?.company || '';
                          const industry = profileContext?.industry || '';
                          const userContext = companyName ? `von ${companyName}${industry ? ` (${industry})` : ''}` : '';
                          
                          let useCase = '';
                          let promptTemplate = '';
                          
                          if (option.includes('Bewerber')) {
                            useCase = 'Bewerber anrufen und Verfügbarkeit/Interesse prüfen';
                            promptTemplate = `Du bist ein professioneller KI-Telefonagent ${userContext} für Recruiting.
Deine Aufgabe: Bewerber anrufen und Verfügbarkeit sowie Interesse prüfen.

KONTEXT:
- Anrufer: ${userName}
- Firma: ${companyName || '[DEINE FIRMA]'}
- Ziel: Bewerber-Screening

GESPRÄCHSABLAUF:
1. "Guten Tag, hier ist ${userName}${companyName ? ` von ${companyName}` : ''}. Ich rufe bezüglich Ihrer Bewerbung an."
2. Interesse und aktuelle Situation erfragen
3. Verfügbarkeit für ein Gespräch klären
4. Bei Interesse: Termin für Folgegespräch vereinbaren
5. Freundliche Verabschiedung

STIL: Professionell, freundlich, wertschätzend.`;
                          } else if (option.includes('Tisch')) {
                            useCase = 'Tisch in einem Restaurant reservieren';
                            promptTemplate = `Du bist ein professioneller KI-Telefonagent ${userContext} für Reservierungen.
Deine Aufgabe: Tischreservierung in einem Restaurant vornehmen.

KONTEXT:
- Anrufer: ${userName}
- Firma: ${companyName || '[DEINE FIRMA]'}
- Ziel: Tischreservierung

GESPRÄCHSABLAUF:
1. "Guten Tag, mein Name ist ${userName}${companyName ? ` von ${companyName}` : ''}. Ich möchte gerne einen Tisch reservieren."
2. Datum und Uhrzeit nennen
3. Anzahl der Personen angeben
4. Besondere Wünsche erwähnen (z.B. Fensterplatz, ruhiger Bereich)
5. Reservierung bestätigen lassen
6. Freundliche bedanken und verabschieden

STIL: Höflich, freundlich, auf den Punkt.`;
                          } else if (option.includes('Meeting')) {
                            useCase = 'Meeting/Termin bestätigen';
                            promptTemplate = `Du bist ein professioneller KI-Telefonagent ${userContext} für Terminmanagement.
Deine Aufgabe: Einen vereinbarten Termin bestätigen.

KONTEXT:
- Anrufer: ${userName}
- Firma: ${companyName || '[DEINE FIRMA]'}
- Ziel: Terminbestätigung

GESPRÄCHSABLAUF:
1. "Guten Tag, hier ist ${userName}${companyName ? ` von ${companyName}` : ''}. Ich rufe an, um unseren Termin zu bestätigen."
2. Datum und Uhrzeit des Termins nennen
3. Bestätigung einholen
4. Bei Bedarf: Alternative Termine anbieten
5. Details klären (Ort, Teilnehmer, Agenda)
6. Freundliche Verabschiedung

STIL: Professionell, effizient, verbindlich.`;
                          }
                          
                          const hiddenPrompt = `[PROMPT GENERIEREN - SOFORT]
Der User hat "${useCase}" gewählt. GENERIERE JETZT SOFORT den fertigen Prompt!

ANTWORTE EXAKT SO (keine anderen Texte, keine Fragen):

"Perfekt! Hier ist dein fertiger Prompt:

\`\`\`
${promptTemplate}
\`\`\`"

Das ist ALLES. Der "Kopieren & zu POWER" Button erscheint automatisch.`;
                          
                          try {
                            const response = await fetch('/api/chat/messages', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ message: hiddenPrompt, hideUserMessage: true }),
                            });
                            
                            const reader = response.body?.getReader();
                            const decoder = new TextDecoder();
                            let fullMessage = '';
                            
                            if (reader) {
                              while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                const chunk = decoder.decode(value, { stream: true });
                                for (const line of chunk.split('\n')) {
                                  if (line.startsWith('data: ')) {
                                    try {
                                      const parsed = JSON.parse(line.slice(6));
                                      if (parsed.content) {
                                        fullMessage += parsed.content;
                                        setStreamingMessage(fullMessage);
                                      }
                                    } catch {}
                                  }
                                }
                              }
                            }
                            
                            setIsThinking(false);
                            setIsStreaming(false);
                            setStreamingMessage('');
                            queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
                          } catch (error) {
                            setIsThinking(false);
                            setIsStreaming(false);
                          }
                          return;
                        }
                        
                        // Handle Kampagne selection - send hidden prompt for campaign questions
                        if (option === 'Kampagne') {
                          setIsThinking(true);
                          setIsStreaming(true);
                          setStreamingMessage('');
                          
                          const userName = profileContext?.name || (user as any)?.firstName || 'du';
                          const hiddenPrompt = `[KAMPAGNE-MODUS]
Der User hat "Kampagne" gewählt. Du MUSST jetzt EXAKT diese Antwort geben:

"Perfekt, ${userName}! 🚀 Eine Kampagne mit bis zu 10.000 Calls.

Ich brauche ein paar Infos, um die perfekte Kampagne zu erstellen:

**1. Was verkaufst du?** (Produkt/Dienstleistung)
**2. Was ist das Ziel?** (z.B. Termin vereinbaren, Lead qualifizieren, Feedback einholen)
**3. Wer ist die Zielgruppe?**

Erzähl mir davon!"

Das ist ALLES. Keine weiteren Erklärungen.`;
                          
                          try {
                            const response = await fetch('/api/chat/messages', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ message: hiddenPrompt, hideUserMessage: true }),
                            });
                            
                            const reader = response.body?.getReader();
                            const decoder = new TextDecoder();
                            let fullMessage = '';
                            
                            if (reader) {
                              while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                const chunk = decoder.decode(value, { stream: true });
                                for (const line of chunk.split('\n')) {
                                  if (line.startsWith('data: ')) {
                                    try {
                                      const parsed = JSON.parse(line.slice(6));
                                      if (parsed.content) {
                                        fullMessage += parsed.content;
                                        setStreamingMessage(fullMessage);
                                      }
                                    } catch {}
                                  }
                                }
                              }
                            }
                            
                            setIsThinking(false);
                            setIsStreaming(false);
                            setStreamingMessage('');
                            queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
                          } catch (error) {
                            setIsThinking(false);
                            setIsStreaming(false);
                          }
                          return;
                        }
                        
                        // Directly send the selected option via mutation
                        sendMessage.mutate(option);
                      }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {(isThinking || isStreaming) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 mb-3"
              >
                <motion.div 
                  className="flex-shrink-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img src={arasAiImage} alt="ARAS AI" className="w-8 h-8 rounded-full object-cover ring-2 ring-[#FE9100]/30" />
                </motion.div>
                
                <motion.div 
                  className="relative px-5 py-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <ThinkingPhaseIndicator />
                      
                      <div className="flex items-center gap-1.5">
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-[#FE9100]"
                            animate={{ 
                              scale: [0.6, 1, 0.6],
                              opacity: [0.3, 1, 0.3]
                            }} 
                            transition={{ 
                              duration: 1.2, 
                              repeat: Infinity, 
                              delay, 
                              ease: 'easeInOut' 
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="px-4 pt-3 pb-4 border-t border-white/5 bg-black/15">
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

          <div className="relative flex items-end space-x-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
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

              <textarea ref={textareaRef} value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyPress} placeholder="Message ARAS AI" className="relative w-full min-h-[48px] max-h-[200px] bg-black/40 text-white placeholder:text-gray-600 placeholder:opacity-50 border-0 rounded-2xl px-4 py-3 pr-12 focus:outline-none resize-none" disabled={sendMessage.isPending} rows={1} />

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

            {/* Modern Call Button */}
            <motion.div className="relative">
              <motion.div
                className="absolute -inset-[2px] rounded-xl"
                style={{
                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                  backgroundSize: '300% 100%',
                  boxShadow: '0 0 20px rgba(254, 145, 0, 0.4)',
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              
              <motion.button
                whileHover={{ 
                  scale: 1.1,
                  rotate: 5,
                  boxShadow: '0 10px 40px rgba(254, 145, 0, 0.6)',
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCallModal(true)}
                className="relative h-12 w-12 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(10, 10, 10, 0.7)',
                  backdropFilter: 'blur(30px)',
                }}
              >
                <Phone className="w-4 h-4 text-[#FE9100]" />
              </motion.button>
            </motion.div>

            <Button onClick={() => handleSendMessage()} size="sm" disabled={!message.trim() || sendMessage.isPending} className="h-12 px-5 bg-white/10 hover:bg-white/15 text-white rounded-xl disabled:opacity-30">
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-6 pb-8 flex items-center justify-center gap-2 text-xs text-gray-500 max-w-4xl mx-auto text-center">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <p>ARAS AI ® kann Fehler machen. Bitte überprüfe daher jede Nachricht genauestens!</p>
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

      {/* 🔥 NEUES CALL WIZARD MODAL - ULTRA HIGH-END DESIGN */}
      <AnimatePresence>
        {showCallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(25px)',
              WebkitBackdropFilter: 'blur(25px)',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isGeneratingPrompt) {
                setShowCallModal(false);
                resetCallWizard();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl"
            >
              {/* Animated Gradient Border */}
              <motion.div
                className="absolute -inset-[3px] rounded-3xl"
                style={{
                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                  backgroundSize: '300% 100%',
                  boxShadow: '0 0 80px rgba(254, 145, 0, 0.4)',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />

              <div
                className="relative rounded-3xl p-8 overflow-hidden"
                style={{
                  background: 'rgba(8, 8, 8, 0.98)',
                  backdropFilter: 'blur(60px)',
                }}
              >
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowCallModal(false);
                    resetCallWizard();
                  }}
                  disabled={isGeneratingPrompt}
                  className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-white/10 transition-all z-50"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <X className="w-5 h-5 text-gray-400" />
                </motion.button>

                {/* Back Button (show after step 1) */}
                {callWizardStep !== 'type' && callWizardStep !== 'generating' && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (callWizardStep === 'usecase') setCallWizardStep('type');
                      else if (callWizardStep === 'input') setCallWizardStep('usecase');
                      else if (callWizardStep === 'result') setCallWizardStep('input');
                    }}
                    className="absolute top-5 left-5 p-2.5 rounded-full hover:bg-white/10 transition-all z-50 flex items-center gap-2"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">Zurück</span>
                  </motion.button>
                )}

                <AnimatePresence mode="wait">
                  {/* STEP 1: Call Type Selection */}
                  {callWizardStep === 'type' && (
                    <motion.div
                      key="type"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-10">
                        <motion.div 
                          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                          style={{
                            background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(163, 78, 0, 0.15))',
                            border: '2px solid rgba(254, 145, 0, 0.4)',
                            boxShadow: '0 0 40px rgba(254, 145, 0, 0.3)',
                          }}
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <Phone className="w-10 h-10 text-[#FE9100]" />
                        </motion.div>
                        <h2 
                          className="text-3xl font-bold mb-2"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          ARAS AI Anruf
                        </h2>
                        <p className="text-gray-500 text-sm">Wähle deinen Anruftyp</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Einzelanruf Option */}
                        <motion.button
                          whileHover={{ scale: 1.03, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedCallType('einzelanruf');
                            setCallWizardStep('usecase');
                          }}
                          className="relative p-6 rounded-2xl text-left group overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.9), rgba(15, 15, 15, 0.95))',
                            border: '1px solid rgba(254, 145, 0, 0.3)',
                          }}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(254, 145, 0, 0.1) 0%, transparent 70%)' }}
                          />
                          <div className="relative">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                              style={{
                                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(254, 145, 0, 0.05))',
                                border: '1px solid rgba(254, 145, 0, 0.3)',
                              }}
                            >
                              <User className="w-7 h-7 text-[#FE9100]" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                              Einzelanruf
                            </h3>
                            <p className="text-xs text-gray-500">Einen Kontakt anrufen</p>
                          </div>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FE9100] opacity-50 group-hover:opacity-100 transition-opacity" />
                        </motion.button>

                        {/* Kampagne Option */}
                        <motion.button
                          whileHover={{ scale: 1.03, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowCallModal(false);
                            resetCallWizard();
                            setLocation('/app/campaigns');
                          }}
                          className="relative p-6 rounded-2xl text-left group overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.9), rgba(15, 15, 15, 0.95))',
                            border: '1px solid rgba(254, 145, 0, 0.3)',
                          }}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(254, 145, 0, 0.1) 0%, transparent 70%)' }}
                          />
                          <div className="relative">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                              style={{
                                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(254, 145, 0, 0.05))',
                                border: '1px solid rgba(254, 145, 0, 0.3)',
                              }}
                            >
                              <Users className="w-7 h-7 text-[#FE9100]" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                              Kampagne
                            </h3>
                            <p className="text-xs text-gray-500">Bis zu 10.000 parallel</p>
                          </div>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FE9100] opacity-50 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: Use Case Selection */}
                  {callWizardStep === 'usecase' && (
                    <motion.div
                      key="usecase"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-8 mt-6">
                        <h2 
                          className="text-2xl font-bold mb-2"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            background: 'linear-gradient(90deg, #e9d7c4, #FE9100)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          Wofür ist der Anruf?
                        </h2>
                        <p className="text-gray-500 text-sm">Wähle einen Anwendungsfall oder beschreibe deinen eigenen</p>
                      </div>

                      {/* Use Case Cards */}
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        {EINZELANRUF_USE_CASES.map((useCase, index) => {
                          const IconComponent = useCase.icon;
                          return (
                            <motion.button
                              key={useCase.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ scale: 1.05, y: -3 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedUseCase(useCase.id);
                                setCustomInput(useCase.promptHint);
                                setCallWizardStep('input');
                              }}
                              className={`relative p-5 rounded-xl text-center group transition-all ${
                                selectedUseCase === useCase.id ? 'border-2 border-[#FE9100]' : 'border border-white/10'
                              }`}
                              style={{
                                background: selectedUseCase === useCase.id 
                                  ? 'rgba(254, 145, 0, 0.1)' 
                                  : 'rgba(255, 255, 255, 0.02)',
                              }}
                            >
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.15), rgba(254, 145, 0, 0.05))',
                                  border: '1px solid rgba(254, 145, 0, 0.25)',
                                }}
                              >
                                <IconComponent className="w-6 h-6 text-[#FE9100]" />
                              </div>
                              <h4 className="text-sm font-semibold text-white mb-1">{useCase.title}</h4>
                              <p className="text-xs text-gray-500">{useCase.description}</p>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Custom Input Option */}
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          setSelectedUseCase(null);
                          setCustomInput('');
                          setCallWizardStep('input');
                        }}
                        className="w-full p-4 rounded-xl border border-dashed border-white/20 hover:border-[#FE9100]/50 transition-all flex items-center justify-center gap-3"
                        style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                      >
                        <MessageCircle className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-400">Eigene Beschreibung eingeben</span>
                      </motion.button>
                    </motion.div>
                  )}

                  {/* STEP 3: Custom Input / Details */}
                  {callWizardStep === 'input' && (
                    <motion.div
                      key="input"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-6 mt-6">
                        <h2 
                          className="text-2xl font-bold mb-2"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            background: 'linear-gradient(90deg, #e9d7c4, #FE9100)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          Details zum Anruf
                        </h2>
                        <p className="text-gray-500 text-sm">Beschreibe was ARAS AI sagen soll</p>
                      </div>

                      <div className="space-y-4">
                        <div className="relative group">
                          <motion.div
                            className="absolute -inset-[2px] rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
                            style={{
                              background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                              backgroundSize: '200% 100%',
                            }}
                            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                          />
                          <textarea
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="z.B. Ich möchte einen Bewerber für die Stelle als Sales Manager anrufen und seine Verfügbarkeit sowie Gehaltsvorstellungen abfragen..."
                            className="relative w-full px-5 py-4 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none resize-none"
                            style={{
                              minHeight: 140,
                              background: 'rgba(15, 15, 15, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                            // FIX: Removed autoFocus to prevent scroll-jump on modal open
                          />
                        </div>

                        {/* Generate Button */}
                        <motion.button
                          whileHover={{ scale: customInput.trim() ? 1.02 : 1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => generateCallPrompt(selectedUseCase, customInput)}
                          disabled={!customInput.trim()}
                          className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3"
                          style={{
                            fontFamily: 'Orbitron, sans-serif',
                            background: customInput.trim() 
                              ? 'linear-gradient(90deg, rgba(254, 145, 0, 0.3), rgba(163, 78, 0, 0.25))'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: '2px solid rgba(254, 145, 0, 0.4)',
                            opacity: customInput.trim() ? 1 : 0.4,
                            boxShadow: customInput.trim() ? '0 10px 40px rgba(254, 145, 0, 0.3)' : 'none',
                          }}
                        >
                          <Sparkles className="w-5 h-5 text-[#FE9100]" />
                          <span className="text-white">Prompt generieren</span>
                          <ChevronRight className="w-5 h-5 text-[#FE9100]" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4: Generating */}
                  {callWizardStep === 'generating' && (
                    <motion.div
                      key="generating"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <motion.div
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{
                          background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(163, 78, 0, 0.15))',
                          border: '2px solid rgba(254, 145, 0, 0.4)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-10 h-10 text-[#FE9100]" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        Generiere Prompt...
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">ARAS AI erstellt den perfekten Anruf-Prompt</p>
                      
                      {generatedPrompt && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-left p-4 rounded-xl mt-4"
                          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
                        >
                          <p className="text-sm text-gray-400 whitespace-pre-wrap">{generatedPrompt}</p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* STEP 5: Result with Copy */}
                  {callWizardStep === 'result' && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-6 mt-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', delay: 0.1 }}
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                          style={{
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(22, 163, 74, 0.15))',
                            border: '2px solid rgba(34, 197, 94, 0.4)',
                            boxShadow: '0 0 40px rgba(34, 197, 94, 0.3)',
                          }}
                        >
                          <CheckCircle className="w-8 h-8 text-green-400" />
                        </motion.div>
                        <h2 
                          className="text-2xl font-bold mb-2"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          Prompt erstellt!
                        </h2>
                        <p className="text-gray-500 text-sm">Kopiere den Prompt und starte deinen Anruf</p>
                      </div>

                      {/* Generated Prompt Display */}
                      <div 
                        className="p-5 rounded-xl mb-5 max-h-[200px] overflow-y-auto aras-scroll"
                        style={{ 
                          background: 'rgba(15, 15, 15, 0.95)', 
                          border: '1px solid rgba(255, 255, 255, 0.1)' 
                        }}
                      >
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{generatedPrompt}</p>
                      </div>

                      {/* Copy & Redirect Button */}
                      <motion.button
                        whileHover={{ scale: 1.02, boxShadow: '0 15px 50px rgba(254, 145, 0, 0.5)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={copyPromptAndRedirect}
                        className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          background: promptCopied 
                            ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.25))'
                            : 'linear-gradient(90deg, rgba(254, 145, 0, 0.3), rgba(163, 78, 0, 0.25))',
                          border: promptCopied 
                            ? '2px solid rgba(34, 197, 94, 0.5)'
                            : '2px solid rgba(254, 145, 0, 0.4)',
                          boxShadow: '0 10px 40px rgba(254, 145, 0, 0.3)',
                        }}
                      >
                        {promptCopied ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <span className="text-white">Kopiert! Weiterleitung...</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5 text-[#FE9100]" />
                            <span className="text-white">Kopieren & zu POWER</span>
                            <ChevronRight className="w-5 h-5 text-[#FE9100]" />
                          </>
                        )}
                      </motion.button>

                      {/* Alternative: Just copy without redirect */}
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        onClick={async () => {
                          await navigator.clipboard.writeText(generatedPrompt);
                          toast({ title: 'Prompt kopiert! ✓' });
                        }}
                        className="w-full mt-3 py-3 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Nur kopieren (ohne Weiterleitung)
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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