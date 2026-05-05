/**
 * ============================================================================
 * JARVIS CHAT — Professional Chat UI like Gemini/ChatGPT
 * ============================================================================
 * 80% Screen Overlay with Sidebar + Main Chat
 * Clean, white, no icons, animations
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, Mic, MicOff, Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "whatsapp-template" | "context-selection";
  contextSelection?: {
    options: string[];
    selected?: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messages: ChatMessage[];
}

interface JarvisChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JarvisChat({ isOpen, onClose }: JarvisChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingContextSelection, setPendingContextSelection] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputText,
      timestamp: new Date(),
    };

    // Detect WhatsApp template request
    const isWhatsAppRequest = /schreib(e)? mir für \w+ eine whatsapp nachricht/i.test(inputText);
    
    let assistantMessage: ChatMessage;

    if (isWhatsAppRequest) {
      // Show context selection
      assistantMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "Welchen Verlauf soll ich nutzen?",
        timestamp: new Date(),
        type: "context-selection",
        contextSelection: {
          options: ["Letzter Verlauf", "Neuer Verlauf", "Konversation ist aktuell"],
        },
      };
    } else {
      // Normal response
      assistantMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "Ich verarbeite deine Anfrage mit dem Wissen aus deiner Datenbank...",
        timestamp: new Date(),
      };
    }

    // Create or update session
    let updatedSession: ChatSession;
    if (currentSession) {
      updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, userMessage, assistantMessage],
        preview: inputText.slice(0, 30),
        timestamp: new Date(),
      };
      setCurrentSession(updatedSession);
      setSessions(sessions.map(s => s.id === currentSession.id ? updatedSession : s));
    } else {
      updatedSession = {
        id: `session-${Date.now()}`,
        title: inputText.slice(0, 30),
        preview: inputText.slice(0, 30),
        timestamp: new Date(),
        messages: [userMessage, assistantMessage],
      };
      setCurrentSession(updatedSession);
      setSessions([updatedSession, ...sessions]);
    }

    setInputText("");
    setIsTyping(false);
  };

  const handleContextSelection = async (selection: string) => {
    setPendingContextSelection(selection);
    setIsTyping(true);

    // Simulate template generation
    setTimeout(() => {
      const templateMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Hier deine Antwort für Martin:\n\n\"Hey Martin, ich wollte mich kurz bei dir melden. Wie läuft's bei dir? Lass uns bald mal quatschen!\"",
        timestamp: new Date(),
        type: "whatsapp-template",
      };

      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          messages: [...currentSession.messages, templateMessage],
        };
        setCurrentSession(updatedSession);
        setSessions(sessions.map(s => s.id === currentSession.id ? updatedSession : s));
      }

      setIsTyping(false);
      setPendingContextSelection(null);
    }, 1500);
  };

  const handleCopyTemplate = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleNewChat = () => {
    setCurrentSession(null);
    setInputText("");
  };

  const handleSessionSelect = (session: ChatSession) => {
    setCurrentSession(session);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              width: "80%",
              height: "80%",
              background: "#FFFFFF",
              borderRadius: "20px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "row",
              overflow: "hidden",
            }}
          >
            {/* SIDEBAR */}
            <div style={{
              width: "240px",
              background: "#F8FAFC",
              borderRight: "1px solid #E2E8F0",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
            }}>
              <button
                onClick={handleNewChat}
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#6366f1",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginBottom: "16px",
                  transition: "all 0.2s",
                }}
              >
                Neuer Chat
              </button>

              <div style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}>
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSessionSelect(session)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: "none",
                      background: currentSession?.id === session.id ? "#6366f1" : "transparent",
                      color: currentSession?.id === session.id ? "#FFFFFF" : "#475569",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      marginBottom: "4px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {session.title}
                    </div>
                    <div style={{
                      fontSize: "11px",
                      opacity: 0.7,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {session.preview}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN CHAT */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "20px",
            }}>
              {/* Chat Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #E2E8F0",
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1E293B",
                }}>
                  JARVIS Chat
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#64748B",
                    transition: "all 0.2s",
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "16px",
              }}>
                {currentSession?.messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "70%",
                    }}
                  >
                    <div style={{
                      background: message.role === "user" ? "#6366f1" : "#FFFFFF",
                      color: message.role === "user" ? "#FFFFFF" : "#1E293B",
                      padding: "12px 16px",
                      borderRadius: message.role === "user" ? "16px 16px 0 16px" : "16px 16px 16px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      boxShadow: message.role === "assistant" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                    }}>
                      {message.content}
                    </div>

                    {/* Context Selection Buttons */}
                    {message.type === "context-selection" && message.contextSelection && (
                      <div style={{
                        display: "flex",
                        gap: "12px",
                        marginTop: "12px",
                      }}>
                        {message.contextSelection.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleContextSelection(option)}
                            style={{
                              padding: "10px 20px",
                              borderRadius: "50px",
                              background: "#F1F5F9",
                              border: "1px solid #E2E8F0",
                              color: "#475569",
                              cursor: "pointer",
                              transition: "all 0.2s",
                              fontSize: "14px",
                              fontWeight: "500",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#6366f1";
                              e.currentTarget.style.color = "#FFFFFF";
                              e.currentTarget.style.borderColor = "#6366f1";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#F1F5F9";
                              e.currentTarget.style.color = "#475569";
                              e.currentTarget.style.borderColor = "#E2E8F0";
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* WhatsApp Template with Copy Button */}
                    {message.type === "whatsapp-template" && (
                      <div style={{
                        marginTop: "12px",
                      }}>
                        <div style={{
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "12px",
                          padding: "16px",
                          position: "relative",
                        }}>
                          <button
                            onClick={() => handleCopyTemplate(message.content)}
                            style={{
                              position: "absolute",
                              top: "12px",
                              right: "12px",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            Kopieren
                          </button>
                          <div style={{
                            fontSize: "14px",
                            lineHeight: "1.6",
                            color: "#1E293B",
                            whiteSpace: "pre-wrap",
                          }}>
                            {message.content}
                          </div>
                        </div>

                        {/* Follow-up Actions */}
                        <div style={{
                          marginTop: "12px",
                          fontSize: "13px",
                          color: "#475569",
                        }}>
                          Kann ich unter erledigt hinterlegen oder sendest du später?
                          <div style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "8px",
                          }}>
                            <button
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: "#6366f1",
                                color: "#FFFFFF",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                              }}
                            >
                              Erledigt hinterlegen
                            </button>
                            <button
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: "#F1F5F9",
                                color: "#475569",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                              }}
                            >
                              Später senden
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      alignSelf: "flex-start",
                    }}
                  >
                    <div style={{
                      background: "#FFFFFF",
                      padding: "12px 16px",
                      borderRadius: "16px 16px 16px 0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      display: "flex",
                      gap: "4px",
                    }}>
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            opacity: [0.5, 1, 0.5],
                            y: [0, -4, 0],
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#6366f1",
                            borderRadius: "50%",
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Field */}
              <div style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-end",
                padding: "16px",
                background: "#F8FAFC",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Schreibe eine Nachricht..."
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    resize: "none",
                    background: "transparent",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    color: "#1E293B",
                    fontFamily: "inherit",
                  }}
                  rows={1}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: "none",
                    background: inputText.trim() ? "#6366f1" : "#F1F5F9",
                    color: inputText.trim() ? "#FFFFFF" : "#94A3B8",
                    cursor: inputText.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                  }}
                >
                  {inputText.trim() ? <ArrowUpRight className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
