'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Send, Smile } from 'lucide-react';

const POPULAR_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👏', '✨', '💯', '🙏', '😍', '👋'];

interface MessageInputProps {
  conversationId: string;
  disabled: boolean;
  hasActiveConversation: boolean;
  onSendMessage: (text: string) => void;
  onTypingStart: (conversationId: string) => void;
  onTypingStop: (conversationId: string) => void;
}

export const MessageInput = React.memo(function MessageInput({
  conversationId,
  disabled,
  hasActiveConversation,
  onSendMessage,
  onTypingStart,
  onTypingStop
}: MessageInputProps) {
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onTypingStopRef = useRef(onTypingStop);
  onTypingStopRef.current = onTypingStop;

  // Stop typing indicator for the exact conversationId on unmount or chat switch
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingRef.current && conversationId) {
        isTypingRef.current = false;
        onTypingStopRef.current(conversationId);
      }
    };
  }, [conversationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || disabled || !hasActiveConversation) return;

    setMessageInput('');
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop(conversationId);
    }
    onSendMessage(trimmed);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (disabled || !hasActiveConversation || !conversationId) return;

    isTypingRef.current = true;
    onTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop(conversationId);
      }
    }, 1500);
  };

  const handleAddEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="p-2.5 sm:p-3 bg-[#202c33] border-t border-[#222e35] relative">
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 left-2 right-2 sm:right-auto sm:left-4 bg-[#222e35] border border-[#374248] rounded-2xl p-2 shadow-2xl flex items-center justify-between sm:justify-start gap-1 z-30 overflow-x-auto">
          {POPULAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="p-1.5 hover:bg-[#374248] rounded-lg text-lg transition-transform hover:scale-125 flex-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] rounded-full transition-colors flex-none"
          title="Insert Emoji"
        >
          <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <Input
          ref={inputRef}
          type="text"
          maxLength={4000}
          placeholder={hasActiveConversation ? 'Type a message' : 'Select a chat to send a message'}
          value={messageInput}
          onChange={handleInputChange}
          disabled={disabled || !hasActiveConversation}
          className="flex-1 h-10 sm:h-11 bg-[#2a3942] border-0 text-sm text-[#e9edef] placeholder:text-[#8696a0] rounded-xl focus-visible:ring-1 focus-visible:ring-[#00a884] px-3.5 sm:px-4"
        />

        <button
          type="submit"
          disabled={disabled || !messageInput.trim() || !hasActiveConversation}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00a884] hover:bg-[#029070] text-white flex items-center justify-center shadow-md transition-all disabled:opacity-40 flex-none"
          title="Send Message"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
        </button>
      </form>
    </div>
  );
});
