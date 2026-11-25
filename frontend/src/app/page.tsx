'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';

import {
  Send,
  LogOut,
  Hash,
  Search,
  Check,
  CheckCheck,
  Smile,
  Plus,
  X,
  MessageSquare,
  Users,
  Circle,
  Copy,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Trash2,
  Eraser,
  ChevronLeft,
  Lock
} from 'lucide-react';

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://130.210.55.231.sslip.io';
const BACKEND_URL = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? RAW_BACKEND_URL.replace(/^http:\/\//i, 'https://')
  : RAW_BACKEND_URL;

const POPULAR_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👏', '✨', '💯', '🙏', '😍', '👋'];

// Deterministic avatar colors
const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-rose-600'
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

interface User {
  _id: string;
  id?: string;
  username: string;
}

interface Message {
  _id: string;
  id?: string;
  conversationId: string;
  sender: string;
  senderName: string;
  text: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  createdAt: string;
  tempId?: string;
}

interface Conversation {
  _id: string;
  id?: string;
  isGroup: boolean;
  name?: string;
  adminId?: string;
  participants: User[];
  lastMessage?: Message | null;
  updatedAt: string;
}

export default function ChatPage() {
  const router = useRouter();

  // Socket & Connection
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // User State
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');

  // Collections
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI State
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [isTypingMap, setIsTypingMap] = useState<Record<string, string>>({});
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ==============================================================================
  // 1. BOOTSTRAP & REAL-TIME SOCKET
  // ==============================================================================
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');

    if (!token || !storedUsername || !storedUserId) {
      router.push('/login');
      return;
    }

    setCurrentUserId(storedUserId);
    setCurrentUsername(storedUsername);

    const loadData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [convRes, usersRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/conversations`, { headers }),
          fetch(`${BACKEND_URL}/api/users`, { headers })
        ]);

        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(convData);
          if (convData.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
            setActiveConversation(convData[0]);
          }
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAllUsers(usersData);
        }
      } catch (err) {
        console.error('Failed to load initial chat data:', err);
      }
    };

    loadData();

    const socketClient = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    setSocket(socketClient);

    socketClient.on('connect', () => setIsConnected(true));
    socketClient.on('disconnect', () => setIsConnected(false));
    socketClient.on('online_users', (userIds: string[]) => setOnlineUserIds(userIds));

    socketClient.on('receive_message', (payload: { message: Message; tempId?: string }) => {
      const { message, tempId } = payload;
      setMessages((prev) => {
        if (tempId && prev.some((m) => m.tempId === tempId)) {
          return prev.map((m) => (m.tempId === tempId ? message : m));
        }
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    socketClient.on('conversation_updated', (payload: { conversationId: string; lastMessage: Message }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => (c._id || c.id) === payload.conversationId);
        if (index === -1) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(index, 1);
        moved.lastMessage = payload.lastMessage;
        moved.updatedAt = new Date().toISOString();
        return [moved, ...updated];
      });
    });

    socketClient.on('user_typing', (data: { conversationId: string; userId: string; username: string }) => {
      setIsTypingMap((prev) => ({ ...prev, [data.conversationId]: data.username }));
    });

    socketClient.on('user_stop_typing', (data: { conversationId: string; userId: string }) => {
      setIsTypingMap((prev) => {
        const next = { ...prev };
        delete next[data.conversationId];
        return next;
      });
    });

    socketClient.on('message_deleted', (payload: { messageId: string; conversationId: string }) => {
      setMessages((prev) => prev.filter((m) => (m._id || m.id) !== payload.messageId));
    });

    socketClient.on('chat_cleared', (payload: { conversationId: string }) => {
      setMessages([]);
      setConversations((prev) =>
        prev.map((c) => ((c._id || c.id) === payload.conversationId ? { ...c, lastMessage: null } : c))
      );
    });

    socketClient.on('conversation_deleted', (payload: { conversationId: string }) => {
      setConversations((prev) => prev.filter((c) => (c._id || c.id) !== payload.conversationId));
      setActiveConversation((prev) => ((prev?._id || prev?.id) === payload.conversationId ? null : prev));
    });

    return () => {
      socketClient.close();
    };
  }, [router]);

  // ==============================================================================
  // 2. CONVERSATION FOCUS & MESSAGE FETCH
  // ==============================================================================
  useEffect(() => {
    if (!activeConversation) return;

    const token = localStorage.getItem('token');
    const convId = activeConversation._id || activeConversation.id;
    if (!convId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages/${convId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Error fetching conversation messages:', err);
      }
    };

    fetchMessages();

    if (socket && isConnected) {
      socket.emit('join_conversation', convId);
      socket.emit('mark_as_read', convId);
    }

    return () => {
      if (socket && isConnected) {
        socket.emit('leave_conversation', convId);
      }
    };
  }, [activeConversation, socket, isConnected]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingMap]);

  // ==============================================================================
  // 3. ACTION DISPATCHERS
  // ==============================================================================
  const handleStartDirectChat = async (user: User) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: user._id || user.id })
      });

      if (res.ok) {
        const conv: Conversation = await res.json();
        setConversations((prev) => {
          const exists = prev.some((c) => (c._id || c.id) === (conv._id || conv.id));
          return exists ? prev : [conv, ...prev];
        });
        setActiveConversation(conv);
        setIsNewChatModalOpen(false);
      }
    } catch (err) {
      console.error('Error creating 1-on-1 chat:', err);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedGroupUsers.length === 0) return;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          participantIds: selectedGroupUsers
        })
      });

      if (res.ok) {
        const newGroup: Conversation = await res.json();
        setConversations((prev) => [newGroup, ...prev]);
        setActiveConversation(newGroup);
        setIsGroupModalOpen(false);
        setGroupName('');
        setSelectedGroupUsers([]);
      }
    } catch (err) {
      console.error('Error creating group channel:', err);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !socket || !activeConversation) return;

    const convId = activeConversation._id || activeConversation.id;
    if (!convId) return;

    const tempId = `temp_${Date.now()}`;
    const textToSend = messageInput.trim();

    const optimisticMsg: Message = {
      _id: tempId,
      tempId,
      conversationId: convId,
      sender: currentUserId,
      senderName: currentUsername,
      text: textToSend,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setMessageInput('');
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing_stop', convId);

    socket.emit('send_message', {
      conversationId: convId,
      text: textToSend,
      tempId
    });

    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    const convId = activeConversation?._id || activeConversation?.id;
    if (!socket || !convId) return;

    socket.emit('typing_start', convId);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', convId);
    }, 1500);
  };

  const handleAddEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  // ==============================================================================
  // DELETION & STORAGE OPTIMIZATION HANDLERS
  // ==============================================================================
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message for everyone?')) return;
    const token = localStorage.getItem('token');
    const convId = activeConversation?._id || activeConversation?.id;

    // Optimistic UI Removal
    setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));

    try {
      if (socket && isConnected) {
        socket.emit('delete_message', { messageId, conversationId: convId });
      } else {
        await fetch(`${BACKEND_URL}/api/messages/${messageId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleClearChat = async () => {
    if (!activeConversation) return;
    const convId = activeConversation._id || activeConversation.id;
    if (!confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) return;

    setMessages([]);
    setConversations((prev) =>
      prev.map((c) => ((c._id || c.id) === convId ? { ...c, lastMessage: null } : c))
    );

    try {
      const token = localStorage.getItem('token');
      if (socket && isConnected) {
        socket.emit('clear_chat', convId);
      } else {
        await fetch(`${BACKEND_URL}/api/conversations/${convId}/messages`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!activeConversation) return;
    const convId = activeConversation._id || activeConversation.id;
    const isGroup = activeConversation.isGroup;
    if (!confirm(`Are you sure you want to delete this ${isGroup ? 'group channel' : 'conversation'} permanently?`)) return;

    setConversations((prev) => prev.filter((c) => (c._id || c.id) !== convId));
    setActiveConversation(null);
    setMessages([]);

    try {
      const token = localStorage.getItem('token');
      if (socket && isConnected) {
        socket.emit('delete_conversation', convId);
      } else {
        await fetch(`${BACKEND_URL}/api/conversations/${convId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Helpers
  const getConversationTitle = (conv: Conversation): string => {
    if (conv.isGroup) return conv.name || 'Group Chat';
    const other = conv.participants.find((p) => (p._id || p.id) !== currentUserId);
    return other ? other.username : 'Direct Chat';
  };

  const isContactOnline = (conv: Conversation): boolean => {
    if (conv.isGroup) return false;
    const other = conv.participants.find((p) => (p._id || p.id) !== currentUserId);
    return other ? onlineUserIds.includes(other._id || other.id || '') : false;
  };

  const formatMessageTime = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSidebarTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filtered lists
  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'direct' && c.isGroup) return false;
    if (activeTab === 'groups' && !c.isGroup) return false;
    return getConversationTitle(c).toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-[100dvh] w-full bg-[#111b21] text-[#e9edef] antialiased overflow-hidden font-sans select-none">
      
      {/* =========================================================================
          LEFT PANEL: TELEGRAM / WHATSAPP STYLE CHAT LIST
          ========================================================================= */}
      <aside
        className={`w-full md:w-80 lg:w-96 flex-none bg-[#111b21] md:border-r border-[#222e35] flex-col h-full z-20 ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        
        {/* User Header */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className={`w-10 h-10 ${getAvatarColor(currentUsername)} text-white font-semibold text-sm shadow-sm`}>
                <AvatarFallback>{currentUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-[#202c33] rounded-full" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#e9edef] leading-tight">{currentUsername}</h2>
              <p className="text-xs text-[#00a884] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] inline-block animate-pulse" /> Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#aebac1]">
            {/* New Direct Chat Modal */}
            <Dialog open={isNewChatModalOpen} onOpenChange={setIsNewChatModalOpen}>
              <DialogTrigger
                render={
                  <button
                    className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
                    title="New Chat"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                }
              />
              <DialogContent className="bg-[#222e35] border-[#374248] text-[#e9edef]">
                <DialogHeader>
                  <DialogTitle className="text-[#e9edef] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00a884]" /> Start Direct Chat
                  </DialogTitle>
                </DialogHeader>
                <div className="py-2 max-h-60 overflow-y-auto space-y-1">
                  {allUsers.length === 0 ? (
                    <p className="text-xs text-[#8696a0] text-center py-4">No other contacts registered yet</p>
                  ) : (
                    allUsers.map((u) => {
                      const isOnline = onlineUserIds.includes(u._id || u.id || '');
                      return (
                        <div
                          key={u._id || u.id}
                          onClick={() => handleStartDirectChat(u)}
                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#111b21] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className={`w-9 h-9 ${getAvatarColor(u.username)} text-white font-semibold text-xs`}>
                                <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              {isOnline && (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] border-2 border-[#222e35] rounded-full" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-[#e9edef]">{u.username}</span>
                          </div>
                          <span className={`text-xs ${isOnline ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>
                            {isOnline ? 'online' : 'offline'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Create Group Modal */}
            <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
              <DialogTrigger
                render={
                  <button
                    className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
                    title="New Group"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                }
              />
              <DialogContent className="bg-[#222e35] border-[#374248] text-[#e9edef]">
                <DialogHeader>
                  <DialogTitle className="text-[#e9edef] flex items-center gap-2">
                    <Hash className="w-5 h-5 text-[#00a884]" /> Create New Group
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">Group Name</label>
                    <Input
                      placeholder="e.g. Project Core, Family, Friends"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="mt-1 bg-[#111b21] border-[#374248] text-sm text-[#e9edef] placeholder:text-[#8696a0]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                      Select Members ({selectedGroupUsers.length})
                    </label>
                    <div className="mt-1 max-h-48 overflow-y-auto space-y-1 border border-[#374248] rounded-xl p-2 bg-[#111b21]">
                      {allUsers.map((u) => {
                        const isSelected = selectedGroupUsers.includes(u._id || u.id || '');
                        return (
                          <div
                            key={u._id || u.id}
                            onClick={() => {
                              const targetId = u._id || u.id || '';
                              setSelectedGroupUsers((prev) =>
                                isSelected ? prev.filter((id) => id !== targetId) : [...prev, targetId]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                              isSelected
                                ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 font-medium'
                                : 'hover:bg-[#202c33] text-[#e9edef]'
                            }`}
                          >
                            <span>{u.username}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#00a884]" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selectedGroupUsers.length === 0}
                    className="bg-[#00a884] hover:bg-[#029070] text-white font-semibold"
                  >
                    Create Group
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 bg-[#111b21] border-b border-[#222e35]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-[#202c33] rounded-lg text-sm text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex gap-2 mt-2 px-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-[#202c33] text-[#00a884] border border-[#00a884]/40 shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'direct'
                  ? 'bg-[#202c33] text-[#00a884] border border-[#00a884]/40 shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'groups'
                  ? 'bg-[#202c33] text-[#00a884] border border-[#00a884]/40 shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <MessageSquare className="w-10 h-10 text-[#8696a0] mx-auto opacity-50" />
              <p className="text-sm font-medium text-[#8696a0]">No chats found</p>
              <p className="text-xs text-[#8696a0]">Click the icons above to start a conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-[#222e35]/50">
              {filteredConversations.map((conv) => {
                const convId = conv._id || conv.id;
                const activeConvId = activeConversation?._id || activeConversation?.id;
                const isActive = activeConvId === convId;
                const title = getConversationTitle(conv);
                const isOnline = isContactOnline(conv);
                const isTyping = convId && isTypingMap[convId];

                return (
                  <div
                    key={convId}
                    onClick={() => setActiveConversation(conv)}
                    className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                      isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                    }`}
                  >
                    {/* Avatar with Online Dot */}
                    <div className="relative flex-none">
                      <Avatar className={`w-12 h-12 ${conv.isGroup ? 'bg-[#005c4b]' : getAvatarColor(title)} text-white font-semibold text-sm shadow-sm`}>
                        <AvatarFallback>
                          {conv.isGroup ? <Hash className="w-6 h-6" /> : title.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-[#111b21] rounded-full" />
                      )}
                    </div>

                    {/* Chat Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-sm font-semibold text-[#e9edef] truncate">{title}</h3>
                        <span className="text-[11px] text-[#8696a0] flex-none ml-2">
                          {formatSidebarTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                        </span>
                      </div>

                      <p className="text-xs truncate text-[#8696a0]">
                        {isTyping ? (
                          <span className="text-[#00a884] font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                            {isTyping} is typing...
                          </span>
                        ) : conv.lastMessage ? (
                          <span className="truncate">
                            <span className="text-[#e9edef]/80 font-medium">
                              {conv.lastMessage.sender === currentUserId ? 'You: ' : `${conv.lastMessage.senderName}: `}
                            </span>
                            {conv.lastMessage.text}
                          </span>
                        ) : (
                          <span className="italic text-[#8696a0]/80">Tap to start chatting</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

      </aside>

      {/* =========================================================================
          RIGHT MAIN STAGE: TELEGRAM / WHATSAPP STYLE CHAT CANVAS
          ========================================================================= */}
      <main
        className={`flex-1 flex-col h-full bg-[#0b141a] relative overflow-hidden ${
          activeConversation ? 'flex' : 'hidden md:flex'
        }`}
      >
        {!activeConversation ? (
          /* Desktop Splash Screen when no chat is selected */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-[#111b21] text-center border-b-[6px] border-[#00a884]">
            <div className="w-20 h-20 rounded-full bg-[#202c33] text-[#00a884] flex items-center justify-center mx-auto mb-4 shadow-xl">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-light text-[#e9edef] mb-2">ChatApp for Web</h2>
            <p className="text-sm text-[#8696a0] max-w-sm leading-relaxed mb-6">
              Send and receive real-time messages with end-to-end relational data integrity. Select a contact or group to start chatting.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
              <Lock className="w-3.5 h-3.5 text-[#00a884]" /> End-to-end encrypted • Bun + PostgreSQL
            </div>
          </div>
        ) : (
          <>
            {/* Top Header */}
            <header className="h-16 px-3 sm:px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between z-10 flex-none">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden p-1.5 -ml-1 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
                  title="Back to chats"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="relative flex-none">
                  <Avatar className={`w-10 h-10 ${activeConversation.isGroup ? 'bg-[#005c4b]' : getAvatarColor(getConversationTitle(activeConversation))} text-white font-semibold text-sm`}>
                    <AvatarFallback>
                      {activeConversation.isGroup ? <Hash className="w-5 h-5" /> : getConversationTitle(activeConversation).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isContactOnline(activeConversation) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] border-2 border-[#202c33] rounded-full" />
                  )}
                </div>

                <div className="truncate">
                  <h2 className="text-sm font-semibold text-[#e9edef] truncate leading-tight">
                    {getConversationTitle(activeConversation)}
                  </h2>
                  <p className="text-xs text-[#8696a0] truncate mt-0.5">
                    {activeConversation.isGroup
                      ? `${activeConversation.participants.length} members`
                      : isContactOnline(activeConversation)
                      ? <span className="text-[#00a884] font-medium">online</span>
                      : 'offline'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 text-[#aebac1]">
                <button
                  onClick={handleClearChat}
                  className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
                  title="Clear Chat History"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteConversation}
                  className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-red-400 transition-colors"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-red-500 animate-pulse'} ml-1`}
                  title={isConnected ? 'WSS Connected' : 'Disconnected'}
                />
              </div>
            </header>

        {/* Message Feed Canvas (WhatsApp / Telegram Styled) */}
        <ScrollArea className="flex-1 px-4 sm:px-12 py-4 bg-[#0b141a]">
          <div className="max-w-3xl mx-auto flex flex-col space-y-2">
            
            {/* Empty State */}
            {activeConversation && messages.length === 0 && (
              <div className="text-center py-20 space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#202c33] text-[#00a884] flex items-center justify-center mx-auto shadow-md">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-semibold text-[#e9edef]">
                  Chat with {getConversationTitle(activeConversation)}
                </h3>
                <p className="text-xs text-[#8696a0] max-w-xs mx-auto">
                  Messages are saved securely in your PostgreSQL database. Say hello!
                </p>
              </div>
            )}

            {/* Centered Date Badge */}
            {messages.length > 0 && (
              <div className="flex justify-center my-3">
                <span className="text-[11px] font-semibold text-[#8696a0] bg-[#182229] border border-[#222e35] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                  Today
                </span>
              </div>
            )}

            {/* Messages Stream */}
            {messages.map((msg, index) => {
              const isMine = msg.sender === currentUserId;
              const msgId = msg._id || msg.id || index.toString();

              return (
                <div
                  key={msgId}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-center gap-1.5`}
                >
                  {/* Delete Button on Hover for My Sent Messages (Left side of outgoing bubble) */}
                  {isMine && (
                    <button
                      onClick={() => handleDeleteMessage(msgId)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1.5 text-[#8696a0] transition-opacity cursor-pointer rounded-full hover:bg-[#202c33]"
                      title="Delete message for everyone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-md text-sm leading-relaxed ${
                      isMine
                        ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs'
                        : 'bg-[#202c33] text-[#e9edef] rounded-tl-xs'
                    }`}
                  >
                    {/* Sender Name in Group Chats */}
                    {!isMine && activeConversation?.isGroup && (
                      <p className="text-[11px] font-bold text-[#53bdeb] mb-0.5">
                        {msg.senderName}
                      </p>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Timestamp & Delivery Double-Tick Status */}
                    <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 text-[10px] text-[#8696a0]">
                      <span className="text-[10px] opacity-80">{formatMessageTime(msg.createdAt)}</span>
                      {isMine && (
                        <span>
                          {msg.status === 'sending' ? (
                            <Circle className="w-2.5 h-2.5 animate-spin text-[#8696a0]" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {activeConversation && isTypingMap[activeConversation._id || activeConversation.id || ''] && (
              <div className="flex items-center gap-2 text-xs text-[#00a884] italic py-1 px-2">
                <span className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce" />
                <span>{isTypingMap[activeConversation._id || activeConversation.id || '']} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Bar (WhatsApp / Telegram Dock) */}
        <div className="p-2.5 sm:p-3 bg-[#202c33] border-t border-[#222e35] relative">
          
          {/* Emoji Picker Menu */}
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-2 right-2 sm:right-auto sm:left-4 bg-[#222e35] border border-[#374248] rounded-2xl p-2 shadow-2xl flex items-center justify-between sm:justify-start gap-1 z-30 overflow-x-auto">
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleAddEmoji(emoji)}
                  className="p-1.5 hover:bg-[#374248] rounded-lg text-lg transition-transform hover:scale-125 flex-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] rounded-full transition-colors flex-none"
              title="Insert Emoji"
            >
              <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <Input
              ref={inputRef}
              type="text"
              placeholder={
                activeConversation
                  ? 'Type a message'
                  : 'Select a chat to send a message'
              }
              value={messageInput}
              onChange={handleInputChange}
              disabled={!isConnected || !activeConversation}
              className="flex-1 h-10 sm:h-11 bg-[#2a3942] border-0 text-sm text-[#e9edef] placeholder:text-[#8696a0] rounded-xl focus-visible:ring-1 focus-visible:ring-[#00a884] px-3.5 sm:px-4"
            />

            <button
              type="submit"
              disabled={!isConnected || !messageInput.trim() || !activeConversation}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00a884] hover:bg-[#029070] text-white flex items-center justify-center shadow-md transition-all disabled:opacity-40 flex-none"
              title="Send Message"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
            </button>
          </form>
        </div>
          </>
        )}

      </main>

    </div>
  );
}
