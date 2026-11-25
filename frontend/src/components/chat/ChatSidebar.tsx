'use client';

import React, { useMemo, useState } from 'react';
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
import { Check, Hash, LogOut, MessageSquare, Plus, Search, Users } from 'lucide-react';
import {
  Conversation,
  User,
  formatSidebarTime,
  getAvatarColor,
  getConversationId,
  getConversationTitle
} from '@/types/chat';

interface ChatSidebarProps {
  currentUserId: string;
  currentUsername: string;
  conversations: Conversation[];
  allUsers: User[];
  activeConversation: Conversation | null;
  onlineUserSet: Set<string>;
  isTypingMap: Record<string, string>;
  onSelectConversation: (conv: Conversation) => void;
  onStartDirectChat: (user: User) => Promise<boolean>;
  onCreateGroup: (name: string, participantIds: string[]) => Promise<boolean>;
  onLogout: () => void;
}

export const ChatSidebar = React.memo(function ChatSidebar({
  currentUserId,
  currentUsername,
  conversations,
  allUsers,
  activeConversation,
  onlineUserSet,
  isTypingMap,
  onSelectConversation,
  onStartDirectChat,
  onCreateGroup,
  onLogout
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);

  const isContactOnline = (conv: Conversation): boolean => {
    if (conv.isGroup) return false;
    const other = conv.participants.find((p) => (p._id || p.id) !== currentUserId);
    return other ? onlineUserSet.has(other._id || other.id || '') : false;
  };

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      if (activeTab === 'direct' && c.isGroup) return false;
      if (activeTab === 'groups' && !c.isGroup) return false;
      return getConversationTitle(c, currentUserId).toLowerCase().includes(q);
    });
  }, [conversations, activeTab, searchQuery, currentUserId]);

  const activeConvId = getConversationId(activeConversation);

  const handleDirectSelect = async (user: User) => {
    const ok = await onStartDirectChat(user);
    if (ok) setIsNewChatModalOpen(false);
  };

  const handleGroupSubmit = async () => {
    if (!groupName.trim() || selectedGroupUsers.length === 0) return;
    const ok = await onCreateGroup(groupName.trim(), selectedGroupUsers);
    if (ok) {
      setIsGroupModalOpen(false);
      setGroupName('');
      setSelectedGroupUsers([]);
    }
  };

  return (
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
                    const isOnline = onlineUserSet.has(u._id || u.id || '');
                    return (
                      <div
                        key={u._id || u.id}
                        onClick={() => handleDirectSelect(u)}
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
                      const targetId = u._id || u.id || '';
                      const isSelected = selectedGroupUsers.includes(targetId);
                      return (
                        <div
                          key={targetId}
                          onClick={() => {
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
                  onClick={handleGroupSubmit}
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
            onClick={onLogout}
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
          {(['all', 'direct', 'groups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#202c33] text-[#00a884] border border-[#00a884]/40 shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
              }`}
            >
              {tab}
            </button>
          ))}
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
              const convId = getConversationId(conv);
              const isActive = activeConvId === convId;
              const title = getConversationTitle(conv, currentUserId);
              const isOnline = isContactOnline(conv);
              const isTyping = convId ? isTypingMap[convId] : undefined;

              return (
                <div
                  key={convId}
                  onClick={() => onSelectConversation(conv)}
                  className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                  }`}
                >
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

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-sm font-semibold text-[#e9edef] truncate">{title}</h3>
                      <span className="text-[11px] text-[#8696a0] flex-none ml-2">
                        {formatSidebarTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
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
                      {!isActive && (conv.unreadCount ?? 0) > 0 && (
                        <span className="flex-none min-w-5 h-5 px-1.5 rounded-full bg-[#00a884] text-[#111b21] text-[11px] font-bold flex items-center justify-center">
                          {(conv.unreadCount ?? 0) > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
});
