'use client';

import React, { useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronLeft,
  Circle,
  Eraser,
  Hash,
  Lock,
  MessageSquare,
  Trash2,
  X
} from 'lucide-react';
import {
  Conversation,
  Message,
  formatDateDivider,
  formatMessageTime,
  getAvatarColor,
  getConversationId,
  getConversationTitle,
  getDateKey
} from '@/types/chat';

interface MessageListProps {
  activeConversation: Conversation | null;
  messages: Message[];
  currentUserId: string;
  onlineUserSet: Set<string>;
  isConnected: boolean;
  typingUsername?: string;
  hasMoreMessages: boolean;
  isLoadingOlder: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onLoadOlderMessages: () => void;
  onBack: () => void;
  onClearChat: () => void;
  onDeleteConversation: () => void;
  onDeleteMessage: (messageId: string) => void;
}

export const MessageList = React.memo(function MessageList({
  activeConversation,
  messages,
  currentUserId,
  onlineUserSet,
  isConnected,
  typingUsername,
  hasMoreMessages,
  isLoadingOlder,
  errorMessage,
  onDismissError,
  onLoadOlderMessages,
  onBack,
  onClearChat,
  onDeleteConversation,
  onDeleteMessage
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLastMsgIdRef = useRef<string>('');

  // Auto-scroll only when the newest message at the bottom changes or typing indicator appears
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg?._id || lastMsg?.id || lastMsg?.tempId || '';
    if (lastId !== prevLastMsgIdRef.current || typingUsername) {
      prevLastMsgIdRef.current = lastId;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsername]);

  if (!activeConversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-[#111b21] text-center border-b-[6px] border-[#00a884]">
        <div className="w-20 h-20 rounded-full bg-[#202c33] text-[#00a884] flex items-center justify-center mx-auto mb-4 shadow-xl">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-light text-[#e9edef] mb-2">ChatApp for Web</h2>
        <p className="text-sm text-[#8696a0] max-w-sm leading-relaxed mb-6">
          Send and receive real-time messages with relational data integrity. Select a contact or group to start chatting.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
          <Lock className="w-3.5 h-3.5 text-[#00a884]" /> Encrypted in Transit (TLS) • Bun + PostgreSQL
        </div>
      </div>
    );
  }

  const title = getConversationTitle(activeConversation, currentUserId);
  const isOtherOnline = (() => {
    if (activeConversation.isGroup) return false;
    const other = activeConversation.participants.find((p) => (p._id || p.id) !== currentUserId);
    return other ? onlineUserSet.has(other._id || other.id || '') : false;
  })();

  const activeConvId = getConversationId(activeConversation);
  const canDeleteConversation =
    !activeConversation.isGroup ||
    !activeConversation.adminId ||
    activeConversation.adminId === currentUserId;

  return (
    <>
      {/* Top Header */}
      <header className="h-16 px-3 sm:px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between z-10 flex-none">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
            title="Back to chats"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="relative flex-none">
            <Avatar className={`w-10 h-10 ${activeConversation.isGroup ? 'bg-[#005c4b]' : getAvatarColor(title)} text-white font-semibold text-sm`}>
              <AvatarFallback>
                {activeConversation.isGroup ? <Hash className="w-5 h-5" /> : title.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOtherOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] border-2 border-[#202c33] rounded-full" />
            )}
          </div>

          <div className="truncate">
            <h2 className="text-sm font-semibold text-[#e9edef] truncate leading-tight">{title}</h2>
            <p className="text-xs text-[#8696a0] truncate mt-0.5">
              {activeConversation.isGroup
                ? `${activeConversation.participants.length} members`
                : isOtherOnline
                ? <span className="text-[#00a884] font-medium">online</span>
                : 'offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 text-[#aebac1]">
          <button
            onClick={onClearChat}
            className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-[#e9edef] transition-colors"
            title="Clear Chat History"
          >
            <Eraser className="w-4 h-4" />
          </button>
          {canDeleteConversation && (
            <button
              onClick={onDeleteConversation}
              className="p-2 hover:bg-[#374248] rounded-full text-[#aebac1] hover:text-red-400 transition-colors"
              title="Delete Conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-red-500 animate-pulse'} ml-1`}
            title={isConnected ? 'WSS Connected' : 'Disconnected'}
          />
        </div>
      </header>

      {errorMessage && (
        <div className="px-4 py-2 bg-red-950/70 border-b border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-2 flex-none">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-none" />
            {errorMessage}
          </span>
          <button
            onClick={onDismissError}
            className="p-1 hover:bg-red-900/60 rounded text-red-300"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Feed Canvas */}
      <ScrollArea className="flex-1 px-4 sm:px-12 py-4 bg-[#0b141a]" key={activeConvId}>
        <div className="max-w-3xl mx-auto flex flex-col space-y-2">
          {/* Cursor Pagination: Load Older Messages */}
          {hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center pt-1 pb-2">
              <button
                onClick={onLoadOlderMessages}
                disabled={isLoadingOlder}
                className="text-xs font-medium text-[#00a884] bg-[#182229] hover:bg-[#202c33] border border-[#222e35] px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                {isLoadingOlder ? 'Loading older messages...' : 'Load older messages'}
              </button>
            </div>
          )}

          {/* Empty State */}
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#202c33] text-[#00a884] flex items-center justify-center mx-auto shadow-md">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-[#e9edef]">Chat with {title}</h3>
              <p className="text-xs text-[#8696a0] max-w-xs mx-auto">
                Messages are saved securely in your PostgreSQL database. Say hello!
              </p>
            </div>
          )}

          {/* Messages Stream with Dynamic Date Grouping */}
          {messages.map((msg, index) => {
            const isMine = msg.sender === currentUserId;
            const msgId = msg._id || msg.id || index.toString();
            const currentDayKey = getDateKey(msg.createdAt);
            const prevDayKey = index > 0 ? getDateKey(messages[index - 1].createdAt) : '';
            const showDateDivider = index === 0 || currentDayKey !== prevDayKey;

            return (
              <React.Fragment key={msgId}>
                {showDateDivider && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-semibold text-[#8696a0] bg-[#182229] border border-[#222e35] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                      {formatDateDivider(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-center gap-1.5`}
                >
                  {isMine && (
                    <button
                      onClick={() => onDeleteMessage(msgId)}
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
                    {!isMine && activeConversation.isGroup && (
                      <p className="text-[11px] font-bold text-[#53bdeb] mb-0.5">
                        {msg.senderName}
                      </p>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 text-[10px] text-[#8696a0]">
                      <span className="text-[10px] opacity-80">{formatMessageTime(msg.createdAt)}</span>
                      {isMine && (
                        <span title={msg.status === 'sending' ? 'Sending' : msg.status === 'read' ? 'Read' : 'Sent'}>
                          {msg.status === 'sending' ? (
                            <Circle className="w-2.5 h-2.5 animate-spin text-[#8696a0]" />
                          ) : msg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Typing Indicator */}
          {typingUsername && (
            <div className="flex items-center gap-2 text-xs text-[#00a884] italic py-1 px-2">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce" />
              <span>{typingUsername} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </>
  );
});
