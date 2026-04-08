/**
 * ============================================================================
 * ARAS TEAM CHAT - Internal Messaging System
 * ============================================================================
 * Premium chat interface for staff/admin communication
 * ARAS CI: Dark premium, glass cards, orange accents
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Hash, Users, Search, Plus, Settings, 
  MessageSquare, ChevronLeft, MoreVertical, Smile,
  Paperclip, Check, CheckCheck, Clock
} from 'lucide-react';
import InternalLayout from '@/components/internal/internal-layout';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';

// ============================================================================
// TYPES
// ============================================================================

interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'dm';
  messageCount?: number;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
}

interface Message {
  id: number;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  replyToId?: number;
  user?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
}

interface ChatUser {
  id: string;
  username: string;
  userRole: string;
  isOnline?: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return `Gestern ${format(date, 'HH:mm')}`;
  return format(date, 'dd.MM. HH:mm');
}

function formatChannelDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Gestern';
  return format(date, 'dd.MM.');
}

function UserAvatar({ user, size = 'md' }: { user?: { username?: string; profileImageUrl?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-base',
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ background: 'linear-gradient(135deg, #FE9100, #a34e00)', color: 'white' }}
    >
      {user?.username?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InternalChat() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['team-chat-channels'],
    queryFn: async () => {
      const res = await fetch('/api/team/chat/channels', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['team-chat-messages', selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel?.id) return { data: [] };
      const res = await fetch(`/api/team/chat/channels/${selectedChannel.id}/messages`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!selectedChannel?.id,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: onlineUsersData } = useQuery({
    queryKey: ['team-chat-online'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/active-users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedChannel?.id) throw new Error('No channel selected');
      const res = await fetch(`/api/team/chat/channels/${selectedChannel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['team-chat-messages', selectedChannel?.id] });
      queryClient.invalidateQueries({ queryKey: ['team-chat-channels'] });
    },
    onError: () => {
      toast({ title: 'Nachricht konnte nicht gesendet werden', variant: 'destructive' });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const res = await fetch('/api/team/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Failed to create channel');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-chat-channels'] });
      if (data.data) setSelectedChannel(data.data);
      toast({ title: '✓ Channel erstellt' });
    },
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  // Select first channel if none selected
  useEffect(() => {
    const channels = channelsData?.data || [];
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channelsData, selectedChannel]);

  // Focus input when channel changes
  useEffect(() => {
    if (selectedChannel) {
      inputRef.current?.focus();
    }
  }, [selectedChannel]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSendMessage = useCallback(() => {
    if (messageInput.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  }, [messageInput, sendMessageMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleCreateChannel = useCallback(() => {
    const name = prompt('Channel-Name:');
    if (name?.trim()) {
      createChannelMutation.mutate({ name: name.trim() });
    }
  }, [createChannelMutation]);

  // ============================================================================
  // DATA
  // ============================================================================

  const channels: Channel[] = channelsData?.data || [];
  const messages: Message[] = messagesData?.data || [];
  const onlineUsers: ChatUser[] = onlineUsersData?.users || [];

  const filteredChannels = channels.filter(c => 
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <InternalLayout>
      <div 
        className="flex h-[calc(100vh-120px)] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(233,215,196,0.08)',
        }}
      >
        {/* SIDEBAR */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 flex flex-col border-r"
              style={{ borderColor: 'rgba(233,215,196,0.08)' }}
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b" style={{ borderColor: 'rgba(233,215,196,0.08)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 
                    className="text-sm font-semibold"
                    style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.9)' }}
                  >
                    Team Chat
                  </h2>
                  <button
                    onClick={handleCreateChannel}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: '#FE9100' }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Suchen..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  />
                </div>
              </div>

              {/* Channels List */}
              <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
                <div className="text-[10px] uppercase font-medium px-2 py-1 mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Channels
                </div>
                
                {channelsLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
                    ))}
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Keine Channels</p>
                    <button
                      onClick={handleCreateChannel}
                      className="mt-2 text-xs px-3 py-1 rounded-lg"
                      style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}
                    >
                      Channel erstellen
                    </button>
                  </div>
                ) : (
                  filteredChannels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors"
                      style={{ 
                        background: selectedChannel?.id === channel.id ? 'rgba(254,145,0,0.1)' : 'transparent',
                        border: selectedChannel?.id === channel.id ? '1px solid rgba(254,145,0,0.2)' : '1px solid transparent',
                      }}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        {channel.type === 'dm' ? (
                          <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        ) : (
                          <Hash className="w-4 h-4" style={{ color: selectedChannel?.id === channel.id ? '#FE9100' : 'rgba(255,255,255,0.5)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-sm font-medium truncate"
                          style={{ color: selectedChannel?.id === channel.id ? '#FE9100' : 'rgba(255,255,255,0.9)' }}
                        >
                          {channel.name}
                        </p>
                        {channel.lastMessage && (
                          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {channel.lastMessage.content}
                          </p>
                        )}
                      </div>
                      {channel.lastMessage && (
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {formatChannelDate(channel.lastMessage.createdAt)}
                        </span>
                      )}
                    </button>
                  ))
                )}

                {/* Online Users Section */}
                <div className="mt-4">
                  <div className="text-[10px] uppercase font-medium px-2 py-1 mb-1 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    Online ({onlineUsers.length})
                  </div>
                  {onlineUsers.slice(0, 5).map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    >
                      <UserAvatar user={{ username: user.username }} size="sm" />
                      <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {user.username}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div 
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: 'rgba(233,215,196,0.08)' }}
          >
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5 md:hidden"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
            
            {selectedChannel ? (
              <>
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(254,145,0,0.1)' }}
                >
                  <Hash className="w-5 h-5" style={{ color: '#FE9100' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 
                    className="text-sm font-semibold truncate"
                    style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.9)' }}
                  >
                    {selectedChannel.name}
                  </h3>
                  {selectedChannel.description && (
                    <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {selectedChannel.description}
                    </p>
                  )}
                </div>
                <button className="p-2 rounded-lg transition-colors hover:bg-white/5">
                  <MoreVertical className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Wähle einen Channel
              </p>
            )}
          </div>

          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4"
            style={{ scrollbarWidth: 'thin' }}
          >
            {!selectedChannel ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-16 h-16 mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Wähle einen Channel um zu chatten
                </p>
              </div>
            ) : messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-12 h-12 mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Noch keine Nachrichten
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Schreibe die erste Nachricht!
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const prevMessage = messages[index - 1];
                  const showAvatar = !prevMessage || prevMessage.userId !== message.userId;
                  const showDate = !prevMessage || 
                    new Date(message.createdAt).toDateString() !== new Date(prevMessage.createdAt).toDateString();

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                          <span className="text-[10px] px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {isToday(new Date(message.createdAt)) ? 'Heute' : 
                             isYesterday(new Date(message.createdAt)) ? 'Gestern' :
                             format(new Date(message.createdAt), 'dd. MMMM yyyy', { locale: de })}
                          </span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        </div>
                      )}
                      <div className={`flex gap-3 ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                        {showAvatar ? (
                          <UserAvatar user={message.user} />
                        ) : (
                          <div className="w-9" />
                        )}
                        <div className="flex-1 min-w-0">
                          {showAvatar && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium" style={{ color: '#FE9100' }}>
                                {message.user?.username || 'Unknown'}
                              </span>
                              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {formatMessageDate(message.createdAt)}
                              </span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          {selectedChannel && (
            <div className="p-4 border-t" style={{ borderColor: 'rgba(233,215,196,0.08)' }}>
              <div 
                className="flex items-center gap-2 p-2 rounded-xl"
                style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <button className="p-2 rounded-lg transition-colors hover:bg-white/5">
                  <Paperclip className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Nachricht an #${selectedChannel.name}...`}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                />
                <button className="p-2 rounded-lg transition-colors hover:bg-white/5">
                  <Smile className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="p-2 rounded-lg transition-all disabled:opacity-50"
                  style={{ 
                    background: messageInput.trim() ? 'linear-gradient(135deg, #FE9100, #a34e00)' : 'rgba(255,255,255,0.05)',
                    color: messageInput.trim() ? 'white' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Enter zum Senden • Shift+Enter für neue Zeile
              </p>
            </div>
          )}
        </div>
      </div>
    </InternalLayout>
  );
}
