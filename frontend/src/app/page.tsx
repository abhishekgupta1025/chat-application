'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { Conversation, Message, User, getConversationId } from '@/types/chat';

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://130.210.55.231.sslip.io';
const BACKEND_URL =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? RAW_BACKEND_URL.replace(/^http:\/\//i, 'https://')
    : RAW_BACKEND_URL;

const PAGE_SIZE = 50;

export default function ChatPage() {
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserSet, setOnlineUserSet] = useState<Set<string>>(() => new Set());

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isTypingMap, setIsTypingMap] = useState<Record<string, string>>({});

  const activeConversationRef = useRef<Conversation | null>(null);
  activeConversationRef.current = activeConversation;
  const currentUserIdRef = useRef<string>('');
  currentUserIdRef.current = currentUserId;

  const handleSessionExpired = useCallback(() => {
    localStorage.clear();
    router.push('/login');
  }, [router]);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response | null> => {
      const token = localStorage.getItem('token');
      if (!token) {
        handleSessionExpired();
        return null;
      }

      const res = await fetch(`${BACKEND_URL}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return null;
      }

      return res;
    },
    [handleSessionExpired]
  );

  // ============================================================================
  // 1. BOOTSTRAP & REAL-TIME SOCKET
  // ============================================================================
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
        const [convRes, usersRes] = await Promise.all([
          authFetch('/api/conversations'),
          authFetch('/api/users')
        ]);

        if (convRes?.ok) {
          const convData = await convRes.json();
          setConversations(convData);
          if (convData.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
            setActiveConversation(convData[0]);
          }
        }

        if (usersRes?.ok) {
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
    socketClient.on('connect_error', (err) => {
      setIsConnected(false);
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('authentication') || msg.includes('token')) {
        handleSessionExpired();
      }
    });

    socketClient.on('online_users', (userIds: string[]) => {
      setOnlineUserSet(new Set(userIds));
    });

    socketClient.on('receive_message', (payload: { message: Message; tempId?: string }) => {
      const { message, tempId } = payload;
      const activeConvId = getConversationId(activeConversationRef.current);
      if (message.conversationId !== activeConvId) return;

      setMessages((prev) => {
        if (tempId && prev.some((m) => m.tempId === tempId)) {
          return prev.map((m) => (m.tempId === tempId ? message : m));
        }
        const msgId = message._id || message.id;
        if (prev.some((m) => (m._id || m.id) === msgId)) return prev;
        return [...prev, message];
      });

      if (message.sender !== currentUserIdRef.current && activeConvId) {
        socketClient.emit('mark_as_read', activeConvId);
      }
    });

    socketClient.on('messages_read', (payload: { conversationId: string; readByUserId: string }) => {
      const activeConvId = getConversationId(activeConversationRef.current);
      if (payload.conversationId !== activeConvId || payload.readByUserId === currentUserIdRef.current) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === currentUserIdRef.current && m.status !== 'read'
            ? { ...m, status: 'read' }
            : m
        )
      );
    });

    socketClient.on('conversation_updated', (payload: { conversationId: string; lastMessage: Message }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => getConversationId(c) === payload.conversationId);
        if (index === -1) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(index, 1);
        updated.unshift({
          ...moved,
          lastMessage: payload.lastMessage,
          updatedAt: new Date().toISOString()
        });
        return updated;
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
      const activeConvId = getConversationId(activeConversationRef.current);
      if (payload.conversationId !== activeConvId) return;
      setMessages((prev) => prev.filter((m) => (m._id || m.id) !== payload.messageId));
    });

    socketClient.on('chat_cleared', (payload: { conversationId: string }) => {
      const activeConvId = getConversationId(activeConversationRef.current);
      if (payload.conversationId === activeConvId) {
        setMessages([]);
        setHasMoreMessages(false);
      }
      setConversations((prev) =>
        prev.map((c) => (getConversationId(c) === payload.conversationId ? { ...c, lastMessage: null } : c))
      );
    });

    socketClient.on('conversation_deleted', (payload: { conversationId: string }) => {
      setConversations((prev) => prev.filter((c) => getConversationId(c) !== payload.conversationId));
      setActiveConversation((prev) =>
        getConversationId(prev) === payload.conversationId ? null : prev
      );
    });

    return () => {
      socketClient.close();
    };
  }, [router, authFetch, handleSessionExpired]);

  // ============================================================================
  // 2. CONVERSATION FOCUS & MESSAGE FETCH
  // ============================================================================
  useEffect(() => {
    const convId = getConversationId(activeConversation);
    if (!convId) return;

    let cancelled = false;
    setHasMoreMessages(false);

    const fetchMessages = async () => {
      try {
        const res = await authFetch(`/api/messages/${convId}?limit=${PAGE_SIZE}`);
        if (res?.ok && !cancelled) {
          const data: Message[] = await res.json();
          setMessages(data);
          setHasMoreMessages(data.length >= PAGE_SIZE);
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
      cancelled = true;
      if (socket && isConnected) {
        socket.emit('leave_conversation', convId);
      }
    };
  }, [activeConversation, socket, isConnected, authFetch]);

  // ============================================================================
  // 3. ACTION HANDLERS
  // ============================================================================
  const handleLoadOlderMessages = useCallback(async () => {
    const convId = getConversationId(activeConversationRef.current);
    if (!convId || messages.length === 0 || isLoadingOlder) return;

    const oldestTimestamp = messages[0]?.createdAt;
    if (!oldestTimestamp) return;

    setIsLoadingOlder(true);
    try {
      const res = await authFetch(
        `/api/messages/${convId}?before=${encodeURIComponent(oldestTimestamp)}&limit=${PAGE_SIZE}`
      );
      if (res?.ok) {
        const older: Message[] = await res.json();
        setHasMoreMessages(older.length >= PAGE_SIZE);
        if (older.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m._id || m.id));
            const uniqueOlder = older.filter((m) => !existingIds.has(m._id || m.id));
            return [...uniqueOlder, ...prev];
          });
        }
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [messages, isLoadingOlder, authFetch]);

  const handleStartDirectChat = useCallback(
    async (user: User): Promise<boolean> => {
      try {
        const res = await authFetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId: user._id || user.id })
        });
        if (!res?.ok) return false;

        const conv: Conversation = await res.json();
        const newId = getConversationId(conv);
        setConversations((prev) =>
          prev.some((c) => getConversationId(c) === newId) ? prev : [conv, ...prev]
        );
        setActiveConversation(conv);
        return true;
      } catch (err) {
        console.error('Error creating 1-on-1 chat:', err);
        return false;
      }
    },
    [authFetch]
  );

  const handleCreateGroup = useCallback(
    async (name: string, participantIds: string[]): Promise<boolean> => {
      try {
        const res = await authFetch('/api/conversations/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, participantIds })
        });
        if (!res?.ok) return false;

        const newGroup: Conversation = await res.json();
        setConversations((prev) => [newGroup, ...prev]);
        setActiveConversation(newGroup);
        return true;
      } catch (err) {
        console.error('Error creating group channel:', err);
        return false;
      }
    },
    [authFetch]
  );

  const handleSendMessage = useCallback(
    (textToSend: string) => {
      const convId = getConversationId(activeConversationRef.current);
      if (!socket || !convId) return;

      const tempId = `temp_${Date.now()}`;
      const optimisticMsg: Message = {
        _id: tempId,
        tempId,
        conversationId: convId,
        sender: currentUserIdRef.current,
        senderName: currentUsername,
        text: textToSend,
        status: 'sending',
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      socket.emit('send_message', { conversationId: convId, text: textToSend, tempId });
    },
    [socket, currentUsername]
  );

  const handleTypingStart = useCallback(() => {
    const convId = getConversationId(activeConversationRef.current);
    if (socket && convId) socket.emit('typing_start', convId);
  }, [socket]);

  const handleTypingStop = useCallback(() => {
    const convId = getConversationId(activeConversationRef.current);
    if (socket && convId) socket.emit('typing_stop', convId);
  }, [socket]);

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!confirm('Are you sure you want to delete this message for everyone?')) return;
      const convId = getConversationId(activeConversationRef.current);
      setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));

      try {
        if (socket && isConnected) {
          socket.emit('delete_message', { messageId, conversationId: convId });
        } else {
          await authFetch(`/api/messages/${messageId}`, { method: 'DELETE' });
        }
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    },
    [socket, isConnected, authFetch]
  );

  const handleClearChat = useCallback(async () => {
    const convId = getConversationId(activeConversationRef.current);
    if (!convId) return;
    if (!confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) return;

    setMessages([]);
    setHasMoreMessages(false);
    setConversations((prev) =>
      prev.map((c) => (getConversationId(c) === convId ? { ...c, lastMessage: null } : c))
    );

    try {
      if (socket && isConnected) {
        socket.emit('clear_chat', convId);
      } else {
        await authFetch(`/api/conversations/${convId}/messages`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  }, [socket, isConnected, authFetch]);

  const handleDeleteConversation = useCallback(async () => {
    const active = activeConversationRef.current;
    const convId = getConversationId(active);
    if (!active || !convId) return;
    if (!confirm(`Are you sure you want to delete this ${active.isGroup ? 'group channel' : 'conversation'} permanently?`)) {
      return;
    }

    setConversations((prev) => prev.filter((c) => getConversationId(c) !== convId));
    setActiveConversation(null);
    setMessages([]);

    try {
      if (socket && isConnected) {
        socket.emit('delete_conversation', convId);
      } else {
        await authFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [socket, isConnected, authFetch]);

  const handleBack = useCallback(() => setActiveConversation(null), []);

  const activeConvId = getConversationId(activeConversation);

  return (
    <div className="flex h-[100dvh] w-full bg-[#111b21] text-[#e9edef] antialiased overflow-hidden font-sans select-none">
      <ChatSidebar
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        conversations={conversations}
        allUsers={allUsers}
        activeConversation={activeConversation}
        onlineUserSet={onlineUserSet}
        isTypingMap={isTypingMap}
        onSelectConversation={setActiveConversation}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroup={handleCreateGroup}
        onLogout={handleSessionExpired}
      />

      <main
        className={`flex-1 flex-col h-full bg-[#0b141a] relative overflow-hidden ${
          activeConversation ? 'flex' : 'hidden md:flex'
        }`}
      >
        <MessageList
          activeConversation={activeConversation}
          messages={messages}
          currentUserId={currentUserId}
          onlineUserSet={onlineUserSet}
          isConnected={isConnected}
          typingUsername={activeConvId ? isTypingMap[activeConvId] : undefined}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlder={isLoadingOlder}
          onLoadOlderMessages={handleLoadOlderMessages}
          onBack={handleBack}
          onClearChat={handleClearChat}
          onDeleteConversation={handleDeleteConversation}
          onDeleteMessage={handleDeleteMessage}
        />

        {activeConversation && (
          <MessageInput
            disabled={!isConnected}
            hasActiveConversation={Boolean(activeConversation)}
            onSendMessage={handleSendMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        )}
      </main>
    </div>
  );
}
