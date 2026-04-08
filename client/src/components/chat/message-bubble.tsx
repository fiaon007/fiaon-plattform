import { motion } from "framer-motion";
import { User, Volume2, VolumeX, Copy, Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import arasAiImage from "@assets/ChatGPT Image 9. Apr. 2025_ 21_38_23_1754515368187.png";

// 🎨 BEAUTIFUL MARKDOWN RENDERER
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let currentList: { items: string[]; ordered: boolean } | null = null;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let lineIndex = 0;

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.ordered ? 'ol' : 'ul';
      elements.push(
        <ListTag key={`list-${lineIndex}`} className={currentList.ordered ? "list-decimal list-inside space-y-1.5 my-3 ml-2" : "list-disc list-inside space-y-1.5 my-3 ml-2"}>
          {currentList.items.map((item, i) => (
            <li key={i} className="text-gray-100 leading-relaxed">
              <span className="ml-2">{parseInlineMarkdown(item)}</span>
            </li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <div key={`codeblock-${lineIndex}`} className="my-6 rounded-xl bg-[#0F0F0F]/80 border border-white/10 overflow-hidden relative group shadow-lg backdrop-blur-sm">
          {/* Glassmorphism gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#FE9100] via-[#FF5E00] to-[#FE9100] opacity-70" />
          
          {/* Content */}
          <div className="relative p-5 font-mono text-[13px] text-gray-200 whitespace-pre-wrap leading-relaxed tracking-wide">
            {codeBlockLines.join('\n')}
          </div>
          
          {/* Copy hint (visible on hover) */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="text-[10px] text-white/40 bg-black/50 px-2 py-1 rounded-md border border-white/5">
              Code Block
            </div>
          </div>
        </div>
      );
      codeBlockLines = [];
    }
  };

  const parseInlineMarkdown = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;

    while (remaining) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
        parts.push(<strong key={`bold-${key++}`} className="font-bold text-white">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = remaining.match(/\*(.*?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) parts.push(remaining.slice(0, italicMatch.index));
        parts.push(<em key={`italic-${key++}`} className="italic text-gray-200">{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Inline code
      const codeMatch = remaining.match(/`(.*?)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        if (codeMatch.index > 0) parts.push(remaining.slice(0, codeMatch.index));
        parts.push(
          <code key={`code-${key++}`} className="px-1.5 py-0.5 rounded bg-white/10 text-[#FE9100] font-mono text-sm border border-white/10">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
        continue;
      }

      parts.push(remaining);
      break;
    }

    return parts;
  };

  lines.forEach((line, i) => {
    lineIndex = i;

    // Handle Code Blocks (```)
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of block
        inCodeBlock = false;
        flushCodeBlock();
      } else {
        // Start of block
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-bold text-white mt-4 mb-2">
          {parseInlineMarkdown(line.slice(4))}
        </h3>
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-white mt-5 mb-3">
          {parseInlineMarkdown(line.slice(3))}
        </h2>
      );
      return;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold text-white mt-6 mb-3">
          {parseInlineMarkdown(line.slice(2))}
        </h1>
      );
      return;
    }

    // Lists
    const unorderedMatch = line.match(/^[-*]\s+(.+)/);
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);

    if (unorderedMatch) {
      if (!currentList || currentList.ordered) {
        flushList();
        currentList = { items: [], ordered: false };
      }
      currentList.items.push(unorderedMatch[1]);
      return;
    }

    if (orderedMatch) {
      if (!currentList || !currentList.ordered) {
        flushList();
        currentList = { items: [], ordered: true };
      }
      currentList.items.push(orderedMatch[2]);
      return;
    }

    // Regular paragraph
    flushList();
    if (line.trim()) {
      elements.push(
        <p key={`p-${i}`} className="text-gray-100 leading-relaxed mb-3">
          {parseInlineMarkdown(line)}
        </p>
      );
    } else {
      elements.push(<div key={`spacer-${i}`} className="h-2" />);
    }
  });

  flushList();
  
  // If still in code block (e.g. streaming not finished), flush what we have
  if (inCodeBlock) {
    flushCodeBlock();
  }
  
  return elements;
};

interface MessageBubbleProps {
  message: string;
  isAi: boolean;
  timestamp: Date;
  confidence?: number;
  onReaction?: (messageId: string, reaction: string) => void;
  messageId?: string;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
  isNew?: boolean;
  onOptionClick?: (option: string) => void;
}

export function MessageBubble({ 
  message, 
  isAi, 
  timestamp, 
  confidence, 
  onReaction, 
  messageId, 
  onSpeak, 
  isSpeaking,
  isNew = false,
  onOptionClick
}: MessageBubbleProps) {
  const [displayedText, setDisplayedText] = useState(isAi && isNew ? "" : message);
  const [isTyping, setIsTyping] = useState(isAi && isNew);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAi && isNew && message) {
      let currentIndex = 0;
      setDisplayedText("");
      setIsTyping(true);

      const interval = setInterval(() => {
        if (currentIndex < message.length) {
          setDisplayedText(message.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, 15);

      return () => clearInterval(interval);
    } else if (!isNew) {
      setDisplayedText(message);
      setIsTyping(false);
    }
  }, [message, isAi, isNew]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Detect clickable options in message
  const renderClickableOptions = () => {
    if (!onOptionClick || !isAi) return null;
    
    // 1. Initial Einzelanruf/Kampagne choice
    const hasInitialChoice = message.includes('Einzelanruf') && message.includes('Kampagne') && message.includes('Klicke');
    if (hasInitialChoice) {
      return (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOptionClick('Einzelanruf')}
            className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/20 hover:border-[#FE9100]/50 transition-all duration-300 group"
          >
            <span className="text-lg">📞</span>
            <div className="text-left">
              <div className="text-white font-medium text-sm">Einzelanruf</div>
              <div className="text-gray-400 text-xs">Ein einzelnes Telefonat</div>
            </div>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOptionClick('Kampagne')}
            className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/20 hover:border-[#FE9100]/50 transition-all duration-300 group"
          >
            <span className="text-lg">🚀</span>
            <div className="text-left">
              <div className="text-white font-medium text-sm">Kampagne</div>
              <div className="text-gray-400 text-xs">bis zu 10.000 Calls gleichzeitig!</div>
            </div>
          </motion.button>
        </div>
      );
    }
    
    // 2. Einzelanruf use case selection (after user selected Einzelanruf)
    const hasUseCaseSelection = message.includes('Anwendungsfall') || message.includes('wofür') || message.includes('Was soll');
    if (hasUseCaseSelection && !message.includes('Kampagne')) {
      return (
        <div className="flex flex-col gap-2 mt-4">
          <div className="text-xs text-gray-400 mb-1">Schnellauswahl:</div>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOptionClick('Bewerber prüfen - Ich möchte einen Bewerber anrufen und seine Verfügbarkeit/Interesse prüfen')}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 hover:border-[#FE9100]/50 text-white text-sm transition-all"
            >
              👤 Bewerber prüfen
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOptionClick('Tisch reservieren - Ich möchte in einem Restaurant einen Tisch reservieren')}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 hover:border-[#FE9100]/50 text-white text-sm transition-all"
            >
              🍽️ Tisch reservieren
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOptionClick('Meeting bestätigen - Ich möchte einen Termin/Meeting bestätigen lassen')}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 hover:border-[#FE9100]/50 text-white text-sm transition-all"
            >
              📅 Meeting bestätigen
            </motion.button>
          </div>
          <div className="text-xs text-gray-500 mt-2">Oder beschreibe deinen Anwendungsfall im Chat...</div>
        </div>
      );
    }
    
    // 3. Detect generated prompt (contains PROMPT markers or specific structure)
    const hasGeneratedPrompt = message.includes('[PROMPT]') || message.includes('```') || 
      (message.includes('Hier ist dein Prompt') || message.includes('fertiger Prompt'));
    if (hasGeneratedPrompt) {
      // Extract prompt from message
      const promptMatch = message.match(/```[\s\S]*?```/) || message.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
      const promptText = promptMatch ? promptMatch[0].replace(/```/g, '').replace(/\[PROMPT\]|\[\/PROMPT\]/g, '').trim() : message;
      
      return (
        <div className="flex flex-col gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await navigator.clipboard.writeText(promptText);
              localStorage.setItem('aras_prefilled_prompt', promptText);
              onOptionClick('__REDIRECT_POWER__');
            }}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#FE9100]/20 to-[#FE9100]/10 border border-[#FE9100]/50 hover:border-[#FE9100] text-white font-medium transition-all duration-300"
          >
            <Copy className="w-5 h-5" />
            <span>Kopieren & zu POWER</span>
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      );
    }
    
    // 4. Detect Kampagne data (contains campaign structure)
    const hasKampagneData = message.includes('Kampagnenname') && message.includes('Ziel des Anrufs');
    if (hasKampagneData) {
      return (
        <div className="flex flex-col gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // Store campaign data in localStorage
              localStorage.setItem('aras_prefilled_campaign', message);
              onOptionClick('__REDIRECT_CAMPAIGNS__');
            }}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#FE9100]/20 to-[#FE9100]/10 border border-[#FE9100]/50 hover:border-[#FE9100] text-white font-medium transition-all duration-300"
          >
            <Copy className="w-5 h-5" />
            <span>Übernehmen & zu Kampagnen</span>
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isAi ? 'justify-start' : 'justify-end'} mb-3`}
    >
      <div className={`flex items-start ${isAi ? 'gap-3' : 'gap-3 flex-row-reverse'} max-w-[68%]`}>
        <motion.div className="flex-shrink-0" whileHover={{ scale: 1.05 }}>
          {isAi ? (
            <img src={arasAiImage} alt="ARAS AI" className="w-8 h-8 rounded-full object-cover ring-2 ring-[#FE9100]/20" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FE9100] to-[#a34e00] flex items-center justify-center ring-2 ring-[#FE9100]/20">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.div>
        
        <div className="flex flex-col max-w-full">
          <div className="relative">
            {!isAi && (
              <div className="absolute -inset-[1px] rounded-xl">
                <motion.div
                  className="w-full h-full rounded-xl"
                  animate={{
                    background: [
                      "linear-gradient(90deg, rgba(233, 215, 196, 0.2) 0%, rgba(254, 145, 0, 0.2) 50%, rgba(233, 215, 196, 0.2) 100%)",
                      "linear-gradient(90deg, rgba(254, 145, 0, 0.2) 0%, rgba(233, 215, 196, 0.2) 50%, rgba(254, 145, 0, 0.2) 100%)",
                      "linear-gradient(90deg, rgba(233, 215, 196, 0.2) 0%, rgba(254, 145, 0, 0.2) 50%, rgba(233, 215, 196, 0.2) 100%)",
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  style={{
                    padding: '1px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
              </div>
            )}

            <motion.div 
              className={`relative px-5 py-4 rounded-2xl ${
                isAi 
                  ? 'bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm' 
                  : 'bg-transparent text-white'
              }`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-[15px] leading-relaxed">
                {isAi && !isTyping ? (
                  <div className="space-y-2">
                    {renderMarkdown(displayedText)}
                    {renderClickableOptions()}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-gray-100">
                    {displayedText}
                    {isTyping && (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="inline-block w-[2px] h-[18px] bg-[#FE9100] ml-1 align-middle"
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
          
          <div className={`flex items-center mt-1 px-1.5 space-x-2 ${isAi ? '' : 'flex-row-reverse space-x-reverse'}`}>
            <p className="text-xs text-gray-500">{format(timestamp, 'HH:mm')}</p>
            {isAi && (
              <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleCopy} 
                  className="h-6 w-6 p-0 hover:bg-white/10 rounded-lg"
                  title="Text kopieren"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-[#FE9100]" />
                  )}
                </Button>
                {onSpeak && (
                  <Button size="sm" variant="ghost" onClick={() => onSpeak(message)} className="h-6 w-6 p-0 hover:bg-white/10 rounded-lg" disabled={isSpeaking}>
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-[#FE9100]" /> : <Volume2 className="w-3.5 h-3.5 text-gray-400 hover:text-[#FE9100]" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}