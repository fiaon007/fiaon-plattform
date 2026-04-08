/**
 * ============================================================================
 * ARAS COMMAND CENTER - Team Feed Section
 * ============================================================================
 * Premium chat-style collaboration feed
 * ARAS CI: "Apple meets Neuralink"
 * DE-Texte, Farb-Logik, Premium-Akzente
 * ============================================================================
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Send, Paperclip, Image, X, MessageSquare, ArrowDown } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { isDemoModeActive, getDemoFeedItems, type DemoFeedItem } from '@/lib/internal/team-feed-demo-seed';

// ============================================================================
// TYPES
// ============================================================================

interface FeedItem {
  id: number;
  authorUserId: string;
  authorUsername: string;
  actorName?: string;
  type: string;
  message: string;
  body?: string;
  title?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, any>;
  createdAt: string;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'image';
  preview?: string;
}

interface TeamFeedSectionProps {
  currentUserId?: string;
  currentUsername?: string;
  onItemClick?: (item: FeedItem) => void;
}

// ============================================================================
// MOTION VARIANTS (Reduced Motion Support)
// ============================================================================

const messageVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }
  },
  hiddenReduced: { opacity: 0 },
  visibleReduced: { 
    opacity: 1,
    transition: { duration: 0.15 }
  },
};

// ============================================================================
// LIVE PULSE DOT
// ============================================================================

function LivePulseDot() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#22c55e' }}
        animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: '#22c55e', fontFamily: 'Inter, sans-serif' }}
      >
        LIVE
      </span>
    </div>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

function TypingIndicator({ username }: { username?: string }) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
        style={{ 
          background: 'linear-gradient(135deg, #FE9100, #a34e00)', 
          color: 'white',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.12)'
        }}
      >
        {username?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: '#ff6a00' }}
              animate={shouldReduceMotion ? {} : { scale: [0.8, 1, 0.8] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          tippt…
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({
  item,
  isOwn,
  onClick,
  hideHeader = false,
}: {
  item: FeedItem;
  isOwn: boolean;
  onClick?: () => void;
  hideHeader?: boolean | null;
}) {
  const shouldReduceMotion = useReducedMotion();
  
  const getRoleBadge = (type: string) => {
    const badges: Record<string, string> = {
      announcement: 'Ankündigung',
      update: 'Update',
      note: 'Notiz',
      system: 'System',
      post: 'Beitrag',
    };
    return badges[type] || type;
  };

  // Bubble styles based on own vs other
  const bubbleStyles = isOwn
    ? {
        background: 'rgba(255,106,0,0.08)',
        border: '1px solid rgba(255,106,0,0.22)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }
    : {
        background: 'rgba(233,215,196,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      };

  // Avatar ring color
  const avatarRingStyle = isOwn
    ? { boxShadow: '0 0 0 2px rgba(255,106,0,0.30)' }
    : { boxShadow: '0 0 0 2px rgba(255,255,255,0.12)' };

  return (
    <motion.div
      initial={shouldReduceMotion ? 'hiddenReduced' : 'hidden'}
      animate={shouldReduceMotion ? 'visibleReduced' : 'visible'}
      variants={messageVariants}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
      style={{ maxWidth: '100%' }}
    >
      <button
        onClick={onClick}
        className={`group text-left rounded-[14px] focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
          shouldReduceMotion ? '' : 'transition-all duration-[140ms] hover:-translate-y-px'
        }`}
        style={{
          maxWidth: '72%',
          cursor: 'pointer',
        }}
      >
        <div
          className={`relative rounded-[14px] p-3 overflow-hidden ${
            shouldReduceMotion ? '' : 'transition-shadow duration-[140ms] group-hover:shadow-lg'
          }`}
          style={bubbleStyles}
        >
          {/* Accent Line (inside bubble) */}
          <div
            className="absolute top-0 bottom-0 w-[2px] rounded-full"
            style={{
              [isOwn ? 'right' : 'left']: '0',
              background: isOwn 
                ? 'linear-gradient(180deg, rgba(255,106,0,0.4) 0%, rgba(163,78,0,0.1) 100%)'
                : 'linear-gradient(180deg, rgba(233,215,196,0.3) 0%, rgba(233,215,196,0.05) 100%)',
            }}
          />

          {/* Message Header (hidden for grouped messages) */}
          {!hideHeader && (
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                style={{ 
                  background: 'linear-gradient(135deg, #FE9100, #a34e00)', 
                  color: 'white',
                  ...avatarRingStyle,
                }}
              >
                {item.authorUsername?.[0]?.toUpperCase() || item.actorName?.[0]?.toUpperCase() || '?'}
              </div>
              <span
                className="text-[13px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}
              >
                {isOwn ? 'Du' : (item.authorUsername || item.actorName || 'Unbekannt')}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(254,145,0,0.08), rgba(163,78,0,0.08))',
                  color: '#FE9100',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {getRoleBadge(item.type)}
              </span>
              <span
                className="text-[11px] ml-auto"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif' }}
              >
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: de })}
              </span>
            </div>
          )}

          {/* Message Content */}
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif' }}
          >
            {item.message || item.body || item.title}
          </p>
        </div>
      </button>
    </motion.div>
  );
}

// ============================================================================
// ATTACHMENT PREVIEW
// ============================================================================

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-3 p-2 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxHeight: '64px',
      }}
    >
      {attachment.type === 'image' && attachment.preview ? (
        <img
          src={attachment.preview}
          alt={attachment.name}
          className="w-10 h-10 rounded object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded flex items-center justify-center"
          style={{ background: 'rgba(254,145,0,0.1)' }}
        >
          <Paperclip className="w-4 h-4" style={{ color: '#FE9100' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {attachment.name}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {formatSize(attachment.size)}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-white/10 transition-colors"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TeamFeedSection({
  currentUserId,
  currentUsername,
  onItemClick,
}: TeamFeedSectionProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | undefined>();
  const [showOwnTyping, setShowOwnTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setHasNewMessages(false);
    }
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      if (atBottom) setHasNewMessages(false);
    }
  }, []);

  // Fetch feed items
  const { data: feedData, isLoading } = useQuery({
    queryKey: ['command-center-feed'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/team-feed?limit=500');
      if (!res.ok) throw new Error('Failed to fetch feed');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const apiFeedItems: FeedItem[] = feedData?.items || [];
  
  // Demo mode detection
  const isDemo = useMemo(() => isDemoModeActive(), []);
  const demoItems = useMemo(() => isDemo ? getDemoFeedItems() : [], [isDemo]);
  
  // Merge demo data with real data (demo data only in demo mode)
  const feedItems: FeedItem[] = useMemo(() => {
    if (!isDemo) return apiFeedItems;
    // In demo mode, show demo data (converted to FeedItem format)
    return demoItems.slice(0, 80).map(d => ({
      id: d.id,
      authorUserId: d.authorUserId,
      authorUsername: d.authorUsername,
      type: d.type,
      message: d.message,
      body: d.body,
      createdAt: d.createdAt,
      meta: d.meta,
    }));
  }, [isDemo, apiFeedItems, demoItems]);
  
  // Load more state for demo mode
  const [loadedCount, setLoadedCount] = useState(80);
  const hasMoreDemoItems = isDemo && demoItems.length > loadedCount;
  
  const loadMoreDemoItems = useCallback(() => {
    setLoadedCount(prev => Math.min(prev + 80, 280));
  }, []);

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/internal/command-center/team-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, type: 'post' }),
      });
      if (!res.ok) throw new Error('Failed to post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-center-feed'] });
      setMessage('');
      setAttachments([]);
      setShowOwnTyping(false);
    },
  });

  // TASK 5: Local typing indicator simulation (300ms inactivity timeout)
  useEffect(() => {
    if (message.length > 0) {
      setShowOwnTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to hide typing after 300ms of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setShowOwnTyping(false);
      }, 300);
    } else {
      setShowOwnTyping(false);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message]);

  // Check if can send (message OR attachments)
  const canSend = message.trim().length > 0 || attachments.length > 0;

  const handleSend = useCallback(() => {
    if (canSend && !postMutation.isPending) {
      postMutation.mutate(message.trim());
    }
  }, [canSend, message, postMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter = send, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type,
      preview: type === 'image' ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Sort messages oldest to newest for chat display
  const sortedItems = useMemo(() => {
    return [...feedItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [feedItems]);

  return (
    <div
      className="w-full"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}
    >
      {/* Glass Feed Card */}
      <div
        className="rounded-2xl flex flex-col"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,106,0,0.18)',
          boxShadow: '0 0 0 1px rgba(255,106,0,0.12), 0 12px 40px rgba(0,0,0,0.6)',
          padding: '20px',
        }}
      >
        {/* Feed Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-[14px] font-bold tracking-[0.18em] uppercase"
              style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
            >
              TEAM-FEED
            </h2>
            <p
              className="text-[12px] mt-0.5"
              style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.65)' }}
            >
              Interne Updates & Abstimmung
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Letzte Nachricht Button */}
            <button
              onClick={scrollToBottom}
              className="h-[34px] px-3 flex items-center gap-2 transition-all duration-150 relative focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: '12px',
                fontWeight: 600,
                // @ts-ignore - CSS custom properties for focus ring
                '--tw-ring-color': 'rgba(255,106,0,0.45)',
                '--tw-ring-offset-color': 'transparent',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(1px)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <ArrowDown className="w-4 h-4" style={{ opacity: 0.8 }} />
              <span style={{ fontFamily: 'Inter, sans-serif' }}>Letzte Nachricht</span>
              {/* Unread Dot - positioned top right */}
              {hasNewMessages && !isAtBottom && (
                <div
                  className="absolute rounded-full"
                  style={{
                    top: '8px',
                    right: '8px',
                    width: '4px',
                    height: '4px',
                    background: 'rgba(255,106,0,0.95)',
                    boxShadow: '0 0 12px rgba(255,106,0,0.45)',
                  }}
                />
              )}
            </button>
            
            {/* Demo Badge */}
            {isDemo && (
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-[0.16em] uppercase"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'rgba(255,106,0,0.10)',
                  border: '1px solid rgba(255,106,0,0.22)',
                  color: '#ff6a00',
                }}
                title="Synthetische Daten für UI-Demo & Tests"
              >
                DEMO-DATEN
              </div>
            )}
            <LivePulseDot />
          </div>
        </div>

        {/* Message List */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 space-y-3 overflow-y-auto pr-2 mb-4"
          style={{
            maxHeight: '400px',
            minHeight: '200px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,106,0,0.3) transparent',
          }}
        >
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="animate-pulse rounded-[14px] p-3"
                  style={{
                    width: '60%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-white/10" />
                    <div className="h-3 w-20 rounded bg-white/10" />
                  </div>
                  <div className="h-4 w-full rounded bg-white/10 mb-1" />
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                </div>
              </div>
            ))
          ) : sortedItems.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-[13px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Noch keine Updates.
              </p>
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Schreib das erste Update
              </p>
            </div>
          ) : (
            // Messages with Day Separators and Grouping
            <>
              {sortedItems.map((item, index) => {
                const currentDate = new Date(item.createdAt);
                const prevItem = index > 0 ? sortedItems[index - 1] : null;
                const prevDate = prevItem ? new Date(prevItem.createdAt) : null;
                
                // Show day separator if date changed
                const showDaySeparator = !prevDate || !isSameDay(currentDate, prevDate);
                
                // Message grouping: hide header if same author within 8 minutes
                const timeDiff = prevDate ? (currentDate.getTime() - prevDate.getTime()) / 60000 : Infinity;
                const isSameAuthorGroup = prevItem && 
                  prevItem.authorUserId === item.authorUserId && 
                  timeDiff < 8 &&
                  !showDaySeparator;
                
                return (
                  <div key={item.id}>
                    {/* Day Separator */}
                    {showDaySeparator && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <span
                          className="text-[10px] font-medium tracking-[0.20em] uppercase px-2"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            color: isToday(currentDate) ? '#ff6a00' : 'rgba(255,255,255,0.55)',
                            background: isToday(currentDate) ? 'rgba(255,106,0,0.10)' : 'transparent',
                            border: isToday(currentDate) ? '1px solid rgba(255,106,0,0.22)' : 'none',
                            borderRadius: isToday(currentDate) ? '999px' : '0',
                            padding: isToday(currentDate) ? '4px 10px' : '0 8px',
                          }}
                        >
                          {isToday(currentDate) ? 'HEUTE' : format(currentDate, 'EEEE, d. MMMM', { locale: de })}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      </div>
                    )}
                    
                    {/* Message Bubble */}
                    <MessageBubble
                      item={item}
                      isOwn={item.authorUserId === currentUserId}
                      onClick={() => onItemClick?.(item)}
                      hideHeader={isSameAuthorGroup}
                    />
                  </div>
                );
              })}
              
              {/* Load More Button (Demo Mode) */}
              {hasMoreDemoItems && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={loadMoreDemoItems}
                    className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all hover:scale-105"
                    style={{
                      background: 'rgba(255,106,0,0.10)',
                      border: '1px solid rgba(255,106,0,0.22)',
                      color: '#ff6a00',
                    }}
                  >
                    Mehr laden
                  </button>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && typingUser && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <TypingIndicator username={typingUser} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Attachment Preview */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 space-y-2"
            >
              {attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => removeAttachment(attachment.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-xl px-3 transition-all focus-within:ring-2 focus-within:ring-orange-500/50"
            style={{
              height: '44px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Teile es mit dem Team der Schwarzott Group! :)"
              className="flex-1 bg-transparent text-[14px] outline-none"
              style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}
            />

            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              title="Datei anhängen"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'file')}
            />

            {/* Image Button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              title="Bild hinzufügen"
            >
              <Image className="w-4 h-4" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'image')}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend || postMutation.isPending}
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
              !canSend || postMutation.isPending 
                ? 'opacity-[0.45] cursor-not-allowed' 
                : 'hover:shadow-lg hover:shadow-orange-500/20'
            }`}
            style={{
              background: 'linear-gradient(135deg, #FE9100, #a34e00)',
              color: 'white',
            }}
            title="Senden"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden inputs for file upload */}
    </div>
  );
}

export default TeamFeedSection;
