import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Copy, Check, ArrowRight } from 'lucide-react';

// ARAS CI Colors
const CI = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  goldDark: '#a34e00',
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface PromptGeneratorChatProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt: (prompt: string) => void;
  initialContext?: string;
}

export function PromptGeneratorChat({ 
  isOpen, 
  onClose, 
  onInsertPrompt,
  initialContext = ''
}: PromptGeneratorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedQuickAction, setSelectedQuickAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick action templates
  const quickActions = [
    { id: 'termin', label: 'Termin verschieben', prompt: 'Ich möchte einen bestehenden Termin verschieben oder einen neuen Termin vereinbaren.' },
    { id: 'bewerber', label: 'Bewerber prüfen', prompt: 'Ich möchte einen Bewerber kontaktieren und seine Verfügbarkeit bzw. Interesse prüfen.' },
    { id: 'angebot', label: 'Angebot präsentieren', prompt: 'Ich möchte ein Angebot oder Produkt präsentieren und Interesse wecken.' },
    { id: 'nachfassen', label: 'Nachfassen', prompt: 'Ich möchte bei einem bestehenden Kontakt nachfassen und den aktuellen Stand erfragen.' }
  ];

  // Initial system message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const systemMessage: Message = {
        id: 'system-1',
        role: 'assistant',
        content: 'Hallo! Ich bin dein ARAS Prompt-Assistent. Ich helfe dir, die perfekte Anweisung für deinen Anruf zu erstellen.\n\nBeschreibe mir kurz: **Was ist das Ziel des Anrufs?**\n\n_z.B. "Ich möchte einen Termin vereinbaren" oder "Ich brauche Informationen über..."_',
        timestamp: new Date()
      };
      setMessages([systemMessage]);
      setStep(1);
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/prompt-generator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          step,
          initialContext
        })
      });

      if (!response.ok) throw new Error('Fehler bei der Generierung');

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStep(data.nextStep || step + 1);

      if (data.generatedPrompt) {
        setGeneratedPrompt(data.generatedPrompt);
      }

    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertPrompt(generatedPrompt);
    handleClose();
  };

  const handleClose = () => {
    setMessages([]);
    setGeneratedPrompt('');
    setStep(0);
    setInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(20,20,20,0.98), rgba(10,10,10,0.99))',
            border: '1px solid rgba(255,106,0,0.2)',
            boxShadow: '0 0 60px rgba(255,106,0,0.15), 0 25px 50px rgba(0,0,0,0.5)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,106,0,0.03)'
            }}
          >
            <div>
              <h2 className="text-base font-bold" style={{ color: CI.gold }}>
                Anweisung erstellen
              </h2>
              <p className="text-xs text-neutral-500">
                KI-gestützte Prompt-Generierung
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Quick Actions - Show only at start */}
          {messages.length === 1 && !isLoading && (
            <div className="px-5 pb-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3">Schnellauswahl</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, index) => (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    onClick={() => {
                      setSelectedQuickAction(action.id);
                      setInput(action.prompt);
                      setTimeout(() => handleSend(), 100);
                    }}
                    className="relative overflow-hidden px-4 py-3 rounded-xl text-left text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] group"
                    style={{
                      background: selectedQuickAction === action.id 
                        ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                        : 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: selectedQuickAction === action.id ? '#000' : CI.gold
                    }}
                  >
                    {/* Typing animation line */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldDark})` }}
                      initial={{ width: '0%' }}
                      whileHover={{ width: '100%' }}
                      transition={{ duration: 0.3 }}
                    />
                    {action.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px] max-h-[400px]">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    message.role === 'user' 
                      ? 'rounded-br-md' 
                      : 'rounded-bl-md'
                  }`}
                  style={{
                    background: message.role === 'user' 
                      ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                      : 'rgba(255,255,255,0.05)',
                    color: message.role === 'user' ? '#000' : CI.gold,
                    border: message.role === 'user' 
                      ? 'none' 
                      : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/_(.*?)_/g, '<em style="color: rgba(255,255,255,0.6)">$1</em>')
                        .replace(/\n/g, '<br/>')
                    }} 
                  />
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div 
                  className="px-4 py-3 rounded-2xl rounded-bl-md"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ background: CI.orange }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-neutral-500">ARAS denkt nach...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Generated Prompt Preview */}
          <AnimatePresence>
            {generatedPrompt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-5 mb-4 overflow-hidden"
              >
                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    background: 'rgba(255,106,0,0.08)', 
                    border: '1px solid rgba(255,106,0,0.25)' 
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: CI.orange }}>
                      Generierte Anweisung
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
                        style={{ color: CI.gold, border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Kopiert!' : 'Kopieren'}
                      </button>
                      <button
                        onClick={handleInsert}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ 
                          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                          color: '#000'
                        }}
                      >
                        <ArrowRight className="w-3 h-3" />
                        Einfügen
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: CI.gold }}>
                    {generatedPrompt}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div 
            className="px-5 py-4"
            style={{ 
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.3)'
            }}
          >
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Deine Antwort eingeben..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all disabled:opacity-50"
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: CI.gold
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
                style={{ 
                  background: input.trim() && !isLoading 
                    ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                    : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Send className={`w-5 h-5 ${input.trim() && !isLoading ? 'text-black' : 'text-neutral-500'}`} />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-neutral-600 text-center">
              Powered by ARAS AI • Deine Daten bleiben privat
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
