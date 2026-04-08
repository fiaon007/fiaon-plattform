import { motion } from "framer-motion";
import { User, Volume2, VolumeX } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import arasAiImage from "@assets/ChatGPT Image 9. Apr. 2025_ 21_38_23_1754515368187.png";

// Import Orbitron font for ARAS badges
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap';
fontLink.rel = 'stylesheet';
if (!document.querySelector(`link[href="${fontLink.href}"]`)) {
  document.head.appendChild(fontLink);
}

// Format markdown text for better readability
const formatMarkdown = (text: string): Array<{ type: string; content: string; isBold?: boolean; number?: string }> => {
  const lines = text.split('\n');
  const formatted: Array<{ type: string; content: string; isBold?: boolean; number?: string }> = [];
  
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines but add them as spacers
    if (!line) {
      if (formatted.length > 0 && formatted[formatted.length - 1].type !== 'spacer') {
        formatted.push({ type: 'spacer', content: '' });
      }
      inList = false;
      continue;
    }
    
    // Handle bullet points (-, *, •)
    if (line.match(/^[-\*•]\s+/)) {
      const content = line.replace(/^[-\*•]\s+/, '').trim();
      formatted.push({ type: 'bullet', content });
      inList = true;
      continue;
    }
    
    // Handle numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const [, number, content] = numberedMatch;
      formatted.push({ type: 'numbered', content: content.trim(), number });
      inList = true;
      continue;
    }
    
    // Check if line contains bold markers
    const hasBold = line.includes('**');
    
    // Regular paragraph
    if (inList) {
      formatted.push({ type: 'spacer', content: '' });
      inList = false;
    }
    
    formatted.push({ 
      type: 'paragraph', 
      content: line,
      isBold: hasBold
    });
  }
  
  return formatted;
};

// Clean bold/italic markers but keep the text
const cleanInlineMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/__(.*?)__/g, '$1')      // Bold alternative
    .replace(/_(.*?)_/g, '$1')        // Italic alternative
    .replace(/`(.*?)`/g, '$1')        // Code
    .replace(/~~(.*?)~~/g, '$1');     // Strikethrough
};

// Parse ARAS signatures and format them
const parseArasSignatures = (text: string) => {
  const signatures = [
    { pattern: /(💡 ARAS®:)/g, type: 'insight', color: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    { pattern: /(🔥 Pro-Tip:)/g, type: 'tip', color: 'from-[#FE9100]/20 to-red-500/20', border: 'border-[#FE9100]/30', text: 'text-[#FE9100]' },
    { pattern: /(🔥 Check das:)/g, type: 'check', color: 'from-[#FE9100]/20 to-red-500/20', border: 'border-[#FE9100]/30', text: 'text-[#FE9100]' },
    { pattern: /(⚡ Fun Fact:)/g, type: 'fact', color: 'from-blue-500/20 to-purple-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  ];

  const parts: Array<{ text: string; type?: string; color?: string; border?: string; textColor?: string }> = [];
  let lastIndex = 0;
  let foundSignature = false;

  signatures.forEach(sig => {
    const matches = Array.from(text.matchAll(sig.pattern));
    matches.forEach(match => {
      if (match.index !== undefined && match.index >= lastIndex) {
        // Add text before signature
        if (match.index > lastIndex) {
          parts.push({ text: text.slice(lastIndex, match.index) });
        }
        // Add signature with styling
        parts.push({ 
          text: match[0], 
          type: sig.type, 
          color: sig.color, 
          border: sig.border,
          textColor: sig.text
        });
        lastIndex = match.index + match[0].length;
        foundSignature = true;
      }
    });
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return foundSignature ? parts : [{ text }];
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
  isNew = false
}: MessageBubbleProps) {
  const formattedContent = isAi ? formatMarkdown(message) : [{ type: 'paragraph', content: message }];
  const plainText = formattedContent.map(part => cleanInlineMarkdown(part.content)).join(' ');
  const [displayedText, setDisplayedText] = useState(isAi && isNew ? "" : plainText);
  const [isTyping, setIsTyping] = useState(isAi && isNew);

  useEffect(() => {
    if (isAi && isNew && plainText) {
      let currentIndex = 0;
      setDisplayedText("");
      setIsTyping(true);

      const interval = setInterval(() => {
        if (currentIndex < plainText.length) {
          setDisplayedText(plainText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, 15);

      return () => clearInterval(interval);
    }
  }, [plainText, isAi, isNew]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isAi ? 'justify-start' : 'justify-end'} mb-6`}
    >
      <div className={`flex items-start ${isAi ? 'space-x-3' : 'space-x-3 flex-row-reverse'} max-w-[75%]`}>
        {/* Avatar */}
        <motion.div 
          className="flex-shrink-0"
          whileHover={{ scale: 1.05 }}
        >
          {isAi ? (
            <img 
              src={arasAiImage} 
              alt="ARAS AI" 
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FE9100]/20"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FE9100] to-[#a34e00] flex items-center justify-center ring-2 ring-[#FE9100]/20">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.div>
        
        <div className="flex flex-col">
          {/* Message Bubble */}
          <motion.div 
            className={`px-6 py-5 rounded-2xl ${
              isAi 
                ? 'bg-white/[0.03] backdrop-blur-sm border border-white/10 text-gray-100' 
                : 'bg-gradient-to-br from-[#FE9100] to-[#a34e00] text-white'
            }`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-[14px] leading-relaxed break-words space-y-3">
              {isAi && (!isNew || !isTyping) ? (
                // Render formatted content when not typing
                formattedContent.map((part, idx) => {
                  const cleanContent = cleanInlineMarkdown(part.content);
                  const signatures = parseArasSignatures(cleanContent);
                  
                  if (part.type === 'spacer') {
                    return <div key={idx} className="h-2" />;
                  }
                  
                  if (part.type === 'bullet') {
                    return (
                      <div key={idx} className="flex items-start gap-2 pl-2">
                        <span className="text-[#FE9100] text-sm mt-0.5">•</span>
                        <span className="flex-1">
                          {signatures.map((sig, sidx) => 
                            sig.type ? (
                              <span
                                key={sidx}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r ${sig.color} border ${sig.border} ${sig.textColor} font-bold text-xs mr-1 mb-1`}
                                style={{ fontFamily: 'Orbitron, sans-serif' }}
                              >
                                {sig.text}
                              </span>
                            ) : (
                              <span key={sidx}>{sig.text}</span>
                            )
                          )}
                        </span>
                      </div>
                    );
                  }
                  
                  if (part.type === 'numbered') {
                    return (
                      <div key={idx} className="flex items-start gap-2 pl-2">
                        <span className="text-[#FE9100] text-sm font-bold mt-0.5">{part.number}.</span>
                        <span className="flex-1">{cleanContent}</span>
                      </div>
                    );
                  }
                  
                  // Paragraph
                  return (
                    <div key={idx} className={part.isBold ? 'font-semibold' : ''}>
                      {signatures.map((sig, sidx) => 
                        sig.type ? (
                          <span
                            key={sidx}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r ${sig.color} border ${sig.border} ${sig.textColor} font-bold text-xs mr-1 mb-1`}
                            style={{ fontFamily: 'Orbitron, sans-serif' }}
                          >
                            {sig.text}
                          </span>
                        ) : (
                          <span key={sidx}>{sig.text}</span>
                        )
                      )}
                    </div>
                  );
                })
              ) : (
                // Show plain text while typing or for user messages
                <>
                  {isAi ? (
                    parseArasSignatures(displayedText).map((part, idx) => (
                      part.type ? (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r ${part.color} border ${part.border} ${part.textColor} font-bold text-xs mr-1 mb-1`}
                          style={{ fontFamily: 'Orbitron, sans-serif' }}
                        >
                          {part.text}
                        </span>
                      ) : (
                        <span key={idx} className="whitespace-pre-wrap">{part.text}</span>
                      )
                    ))
                  ) : (
                    <span className="whitespace-pre-wrap">{displayedText}</span>
                  )}
                </>
              )}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-[2px] h-[18px] bg-[#FE9100] ml-1 align-middle"
                />
              )}
            </div>
          </motion.div>
          
          {/* Timestamp & Actions */}
          <div className={`flex items-center mt-1.5 px-2 space-x-2 ${isAi ? '' : 'flex-row-reverse space-x-reverse'}`}>
            <p className="text-xs text-gray-500">
              {format(timestamp, 'HH:mm')}
            </p>
            {isAi && onSpeak && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSpeak(plainText)}
                className="h-6 w-6 p-0 hover:bg-white/10 rounded-lg"
                disabled={isSpeaking}
              >
                {isSpeaking ? (
                  <VolumeX className="w-3.5 h-3.5 text-[#FE9100]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-gray-400 hover:text-[#FE9100]" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
