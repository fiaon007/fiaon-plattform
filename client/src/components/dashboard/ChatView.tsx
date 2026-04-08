import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Phone, Mail, Calendar, CheckCircle, AlertCircle, Clock, Paperclip, Mic } from 'lucide-react';
import { CI } from '@/lib/constants';

interface Message {
  id: number;
  type: 'ai' | 'user' | 'system';
  content: string;
  time: string;
  details?: string[];
  actions?: string[];
  status?: 'success' | 'warning' | 'info';
  attachment?: {
    type: 'contract' | 'email' | 'calendar';
    name: string;
  };
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'system',
      content: 'KAMPAGNE: TECH-STARTUPS gestartet',
      time: '09:00',
      status: 'info'
    },
    {
      id: 2,
      type: 'ai',
      content: 'Habe gerade mit Lisa von StartupX gesprochen. Sie will das Enterprise Paket! 🎉',
      time: '10:15',
      details: ['Budget: €5k/Monat ✅', 'Start: Januar 2025', 'Decision Maker: CEO'],
      actions: ['📄 Vertrag vorbereitet', '📧 An Lisa senden'],
      status: 'success'
    },
    {
      id: 3,
      type: 'ai',
      content: 'TechCorp will erstmal intern besprechen. Rückruf in 2 Wochen vereinbart.',
      time: '10:23',
      details: ['Decision Maker: CFO ist involviert 👀', 'Budget: €50k verfügbar'],
      actions: ['⏰ Reminder gesetzt für 17.12.']
    },
    {
      id: 4,
      type: 'user',
      content: 'Super! Schick den Vertrag an Lisa',
      time: '10:25'
    },
    {
      id: 5,
      type: 'ai',
      content: '✅ Vertrag wurde an lisa@startupx.com gesendet! Tracking aktiviert.',
      time: '10:25',
      attachment: {
        type: 'contract',
        name: 'Vertrag_StartupX_Enterprise.pdf'
      },
      status: 'success'
    },
    {
      id: 6,
      type: 'ai',
      content: '⚠️ BMW Group hat 3 Emails nicht geöffnet. Soll ich die Strategie ändern?',
      time: '10:30',
      details: ['Letzter Kontakt: vor 12 Tagen', 'Lead wird kalt'],
      actions: ['📱 WhatsApp versuchen?', '📞 Direkt anrufen?'],
      status: 'warning'
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        type: 'ai',
        content: 'Verstanden! Ich kümmere mich sofort darum.',
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        status: 'success'
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'ai': return Bot;
      case 'user': return User;
      default: return AlertCircle;
    }
  };

  const quickActions = [
    { label: 'Status Update', icon: CheckCircle },
    { label: 'Alle Emails senden', icon: Mail },
    { label: 'Termine bestätigen', icon: Calendar },
    { label: 'Kampagne pausieren', icon: Clock }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl overflow-hidden h-[600px] flex flex-col"
      style={{
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-3 h-3 rounded-full bg-green-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm font-bold text-white">KAMPAGNE: TECH-STARTUPS</span>
            <span className="text-xs text-gray-400">10,847 Calls • 342 gewonnen</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.span 
              className="text-xs px-2 py-1 rounded-full"
              style={{ 
                background: 'rgba(254, 145, 0, 0.1)',
                color: CI.orange,
                border: '1px solid rgba(254, 145, 0, 0.3)'
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              LIVE
            </motion.span>
            <span className="text-xs text-gray-400">Erfolgsrate: 4.2%</span>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '450px' }}>
        <AnimatePresence>
          {messages.map((msg) => {
            const Icon = getMessageIcon(msg.type);
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${msg.type === 'user' ? 'order-2' : ''}`}>
                  {/* Message Header */}
                  <div className={`flex items-center gap-2 mb-1 ${msg.type === 'user' ? 'justify-end' : ''}`}>
                    {msg.type !== 'user' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          background: msg.type === 'ai' 
                            ? 'linear-gradient(135deg, #9333ea, #c084fc)'
                            : 'rgba(255,255,255,0.1)'
                        }}
                      >
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="text-xs text-gray-400">
                      {msg.type === 'ai' ? 'ARAS AI' : msg.type === 'user' ? 'Sie' : 'System'}
                    </span>
                    <span className="text-xs text-gray-500">{msg.time}</span>
                  </div>

                  {/* Message Bubble */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`rounded-xl p-3 ${
                      msg.type === 'user' 
                        ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30'
                        : msg.type === 'system'
                        ? 'bg-gray-800/50 border border-gray-700/50'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {/* Status Indicator */}
                    {msg.status && (
                      <div className={`flex items-center gap-2 mb-2 text-xs font-medium ${
                        msg.status === 'success' ? 'text-green-400' :
                        msg.status === 'warning' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`}>
                        {msg.status === 'success' && <CheckCircle className="w-3 h-3" />}
                        {msg.status === 'warning' && <AlertCircle className="w-3 h-3" />}
                        {msg.status === 'info' && <AlertCircle className="w-3 h-3" />}
                        <span>{msg.status.toUpperCase()}</span>
                      </div>
                    )}

                    <p className="text-sm text-white">{msg.content}</p>

                    {/* Details */}
                    {msg.details && (
                      <div className="mt-2 space-y-1">
                        {msg.details.map((detail, idx) => (
                          <div key={idx} className="text-xs text-gray-400 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-gray-600" />
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {msg.actions && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((action, idx) => (
                          <motion.button
                            key={idx}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: 'rgba(254, 145, 0, 0.1)',
                              border: '1px solid rgba(254, 145, 0, 0.3)',
                              color: CI.orange
                            }}
                          >
                            {action}
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {/* Attachment */}
                    {msg.attachment && (
                      <div className="mt-2 p-2 rounded-lg flex items-center gap-2"
                        style={{
                          background: 'rgba(254, 145, 0, 0.05)',
                          border: '1px solid rgba(254, 145, 0, 0.2)'
                        }}
                      >
                        <Paperclip className="w-3 h-3" style={{ color: CI.orange }} />
                        <span className="text-xs text-gray-300">{msg.attachment.name}</span>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #9333ea, #c084fc)' }}
            >
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="flex gap-1">
              <motion.div
                className="w-2 h-2 rounded-full bg-gray-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-gray-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-gray-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          {quickActions.map((action, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <action.icon className="w-3 h-3" style={{ color: CI.goldLight }} />
              <span className="text-gray-300">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsRecording(!isRecording)}
            className={`p-2.5 rounded-lg transition-all ${
              isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400'
            }`}
          >
            <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
          </motion.button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Nachricht an ARAS AI..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="p-2.5 rounded-lg flex items-center justify-center"
            style={{
              background: inputValue.trim() 
                ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldLight})`
                : 'rgba(255,255,255,0.1)',
              opacity: inputValue.trim() ? 1 : 0.5
            }}
            disabled={!inputValue.trim()}
          >
            <Send className="w-4 h-4 text-white" />
          </motion.button>
        </div>

        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-red-400 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Aufnahme läuft... Sprechen Sie jetzt
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
