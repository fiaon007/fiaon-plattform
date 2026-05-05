/**
 * ============================================================================
 * JARVIS CHAT — Luxury Dark Mode Edition
 * ============================================================================
 * Dark Glass Modal with Animated Gradient Background
 * 80% Screen, Apple Glassmorphism, Spring Physics
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, Loader2, Home, User, FileText, BarChart3 } from "lucide-react";

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
            background: "rgba(2, 6, 23, 0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Animated Gradient Background */}
          <motion.div
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #020617 0%, #1e3a8a 50%, #0f172a 100%)",
              backgroundSize: "400% 400%",
              opacity: 0.5,
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 25 
            }}
            style={{
              position: "relative",
              width: "80%",
              height: "80%",
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(20px)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "row",
              overflow: "hidden",
            }}
          >
            {/* SIDEBAR */}
            <div style={{
              width: "240px",
              background: "rgba(15, 23, 42, 0.5)",
              borderRight: "1px solid rgba(255, 255, 255, 0.05)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
            }}>
              {/* 3D Glass Icons - Neumorphismus Style */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "24px",
              }}>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Pulsing Blue Gradient */}
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <Home className="w-6 h-6" style={{ position: "relative", zIndex: 1, color: "#F8FAFC" }} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <User className="w-6 h-6" style={{ position: "relative", zIndex: 1, color: "#F8FAFC" }} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <FileText className="w-6 h-6" style={{ position: "relative", zIndex: 1, color: "#F8FAFC" }} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1.5
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <BarChart3 className="w-6 h-6" style={{ position: "relative", zIndex: 1, color: "#F8FAFC" }} />
                </motion.button>
              </div>

              <motion.button
                onClick={handleNewChat}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300 }}
                style={{
                  padding: "14px 20px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  color: "#020617",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  marginBottom: "20px",
                  letterSpacing: "0.5px",
                }}
              >
                New Chat
              </motion.button>

              <div style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}>
                {sessions.map((session) => (
                  <motion.button
                    key={session.id}
                    onClick={() => handleSessionSelect(session)}
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      background: currentSession?.id === session.id ? "rgba(245, 158, 11, 0.2)" : "transparent",
                      color: currentSession?.id === session.id ? "#F59E0B" : "#F8FAFC",
                      textAlign: "left",
                      cursor: "pointer",
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
                      opacity: 0.6,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {session.preview}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* MAIN CHAT */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "24px",
            }}>
              {/* Chat Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
                paddingBottom: "16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#F8FAFC",
                  letterSpacing: "0.5px",
                }}>
                  JARVIS Command
                </h2>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    padding: "10px",
                    borderRadius: "50%",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.05)",
                    cursor: "pointer",
                    color: "#F8FAFC",
                  }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
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
                <style>{`
                  ::-webkit-scrollbar {
                    width: 6px;
                  }
                  ::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 3px;
                  }
                  ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                  }
                  ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                  }
                `}</style>
                {currentSession?.messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      delay: index * 0.05
                    }}
                    style={{
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "70%",
                    }}
                  >
                    <div style={{
                      background: message.role === "user" 
                        ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                        : "rgba(255, 255, 255, 0.08)",
                      color: message.role === "user" ? "#020617" : "#F8FAFC",
                      padding: "14px 18px",
                      borderRadius: message.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      border: message.role === "assistant" ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
                    }}>
                      {message.content}
                    </div>

                    {/* Context Selection Buttons */}
                    {message.type === "context-selection" && message.contextSelection && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginTop: "12px",
                        }}
                      >
                        {message.contextSelection.options.map((option, i) => (
                          <motion.button
                            key={option}
                            onClick={() => handleContextSelection(option)}
                            whileHover={{ scale: 1.05, backgroundColor: "rgba(245, 158, 11, 0.2)" }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300 }}
                            style={{
                              padding: "10px 18px",
                              borderRadius: "50px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#F8FAFC",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "500",
                            }}
                          >
                            {option}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}

                    {/* WhatsApp Template with Copy Button */}
                    {message.type === "whatsapp-template" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                        style={{
                          marginTop: "12px",
                        }}
                      >
                        <div style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          padding: "16px",
                          position: "relative",
                        }}>
                          <motion.button
                            onClick={() => handleCopyTemplate(message.content)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              position: "absolute",
                              top: "12px",
                              right: "12px",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "rgba(245, 158, 11, 0.2)",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                              color: "#F59E0B",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            Copy
                          </motion.button>
                          <div style={{
                            fontSize: "14px",
                            lineHeight: "1.6",
                            color: "#F8FAFC",
                            whiteSpace: "pre-wrap",
                          }}>
                            {message.content}
                          </div>
                        </div>

                        <div style={{
                          marginTop: "12px",
                          fontSize: "13px",
                          color: "rgba(255, 255, 255, 0.6)",
                        }}>
                          Shall I mark this as complete or send later?
                          <div style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "8px",
                          }}>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                                color: "#020617",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                              }}
                            >
                              Mark Complete
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                background: "rgba(255, 255, 255, 0.05)",
                                color: "#F8FAFC",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                              }}
                            >
                              Send Later
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    style={{
                      alignSelf: "flex-start",
                    }}
                  >
                    <div style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      padding: "14px 18px",
                      borderRadius: "18px 18px 18px 4px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      gap: "4px",
                    }}>
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            y: [0, -6, 0],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut"
                          }}
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#F59E0B",
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
                gap: "12px",
                alignItems: "flex-end",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
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
                  placeholder="Type your command..."
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    resize: "none",
                    background: "transparent",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#F8FAFC",
                    fontFamily: "inherit",
                  }}
                  rows={1}
                />
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: inputText.trim() 
                      ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                    color: inputText.trim() ? "#020617" : "rgba(255, 255, 255, 0.4)",
                    cursor: inputText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {inputText.trim() ? <Loader2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
