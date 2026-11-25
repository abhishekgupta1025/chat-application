export interface User {
  _id: string;
  id?: string;
  username: string;
}

export interface Message {
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

export interface Conversation {
  _id: string;
  id?: string;
  isGroup: boolean;
  name?: string;
  adminId?: string;
  unreadCount?: number;
  participants: User[];
  lastMessage?: Message | null;
  updatedAt: string;
}

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

export const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getConversationId = (conv: Pick<Conversation, '_id' | 'id'> | null | undefined): string =>
  conv?._id || conv?.id || '';

export const getConversationTitle = (conv: Conversation, currentUserId: string): string => {
  if (conv.isGroup) return conv.name || 'Group Chat';
  const other = conv.participants.find((p) => (p._id || p.id) !== currentUserId);
  return other ? other.username : 'Direct Chat';
};

export const formatMessageTime = (dateString: string): string => {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatSidebarTime = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const getDateKey = (dateString: string): string => {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateDivider = (dateString: string): string => {
  const d = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};
