import { Server as SocketIOServer, Socket } from 'socket.io';
import { messageService } from '../services/messageService';
import { conversationService } from '../services/conversationService';
import { conversationRepository } from '../repositories/conversationRepository';
import { AuthenticatedSocket } from '../middleware/socketAuth';

// In-Memory state for live presence tracking (can be backed by Redis at scale)
// Maps userId -> Set of active socket IDs (allows multiple browser tabs)
const onlineUsers = new Map<string, Set<string>>();

// Bounded LRU + TTL cache of conversationId -> participant userIds to scope conversation_updated
const participantCache = new Map<string, { ids: string[]; expiresAt: number }>();
const MAX_PARTICIPANT_CACHE = 2000;
const PARTICIPANT_CACHE_TTL_MS = 5 * 60_000;

export function invalidateParticipantCache(conversationId: string): void {
  participantCache.delete(conversationId);
}

async function getParticipantUserRooms(conversationId: string): Promise<string[]> {
  const now = Date.now();
  const cached = participantCache.get(conversationId);
  let participantIds: string[];

  if (cached && cached.expiresAt > now) {
    // Refresh LRU recency
    participantCache.delete(conversationId);
    participantCache.set(conversationId, cached);
    participantIds = cached.ids;
  } else {
    if (cached) participantCache.delete(conversationId);
    participantIds = await conversationRepository.findParticipantIds(conversationId);
    if (participantCache.size >= MAX_PARTICIPANT_CACHE) {
      const oldestKey = participantCache.keys().next().value;
      if (oldestKey) participantCache.delete(oldestKey);
    }
    participantCache.set(conversationId, {
      ids: participantIds,
      expiresAt: now + PARTICIPANT_CACHE_TTL_MS
    });
  }

  return participantIds.map((id) => `user_${id}`);
}

export const setupSocketServer = (io: SocketIOServer): void => {
  let presenceTimer: ReturnType<typeof setTimeout> | null = null;
  let presenceDirty = false;
  const PRESENCE_THROTTLE_MS = 2000;

  const schedulePresenceBroadcast = (): void => {
    presenceDirty = true;
    if (presenceTimer) return;
    presenceTimer = setTimeout(() => {
      presenceTimer = null;
      if (!presenceDirty) return;
      presenceDirty = false;
      io.emit('online_users', Array.from(onlineUsers.keys()));
    }, PRESENCE_THROTTLE_MS);
  };

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.data.user;

    if (!user) {
      console.warn(`⚠️ Unauthenticated socket connected: ${socket.id}`);
      socket.disconnect();
      return;
    }

    const { userId, username } = user;

    // Join personal room for scoped sidebar/conversation_updated notifications
    socket.join(`user_${userId}`);

    // Track active socket connection
    let userSockets = onlineUsers.get(userId);
    const wasOffline = !userSockets || userSockets.size === 0;
    if (!userSockets) {
      userSockets = new Set<string>();
      onlineUsers.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // Send immediate snapshot to the connecting socket; throttle global broadcast
    socket.emit('online_users', Array.from(onlineUsers.keys()));
    if (wasOffline) {
      schedulePresenceBroadcast();
    }

    // =========================================================================
    // EVENT: JOIN CONVERSATION
    // =========================================================================
    socket.on('join_conversation', async (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;
      socket.join(`conv_${conversationId}`);
    });

    // =========================================================================
    // EVENT: LEAVE CONVERSATION
    // =========================================================================
    socket.on('leave_conversation', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;
      socket.leave(`conv_${conversationId}`);
    });

    // =========================================================================
    // EVENT: SEND MESSAGE
    // =========================================================================
    socket.on(
      'send_message',
      async (data: { conversationId: string; text: string; tempId?: string }) => {
        try {
          const { conversationId, text, tempId } = data;

          if (!conversationId || !text || !text.trim()) {
            socket.emit('error_message', { error: 'Invalid message payload' });
            return;
          }

          // Single-CTE message insert + conversation update
          const formattedMessage = await messageService.sendMessage(
            conversationId,
            userId,
            username,
            text
          );

          const roomName = `conv_${conversationId}`;

          // Broadcast to active participants in the conversation room
          io.to(roomName).emit('receive_message', {
            message: formattedMessage,
            tempId
          });

          // Scope conversation_updated to this conversation's participant user rooms
          const targetRooms = await getParticipantUserRooms(conversationId);
          if (targetRooms.length > 0) {
            io.to(targetRooms).emit('conversation_updated', {
              conversationId,
              lastMessage: formattedMessage
            });
          } else {
            io.to(roomName).emit('conversation_updated', {
              conversationId,
              lastMessage: formattedMessage
            });
          }
        } catch (error: any) {
          console.error('Error handling send_message socket event:', error);
          socket.emit('error_message', { error: error.message || 'Failed to deliver message' });
        }
      }
    );

    // =========================================================================
    // EVENT: TYPING INDICATORS (Throttled on Client)
    // =========================================================================
    socket.on('typing_start', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;
      const roomName = `conv_${conversationId}`;
      socket.to(roomName).emit('user_typing', {
        conversationId,
        userId,
        username
      });
    });

    socket.on('typing_stop', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;
      const roomName = `conv_${conversationId}`;
      socket.to(roomName).emit('user_stop_typing', {
        conversationId,
        userId
      });
    });

    // =========================================================================
    // EVENT: MARK MESSAGES AS READ
    // =========================================================================
    socket.on('mark_as_read', async (conversationId: string) => {
      try {
        if (!conversationId) return;

        await messageService.markAsRead(conversationId, userId);

        const roomName = `conv_${conversationId}`;
        socket.to(roomName).emit('messages_read', {
          conversationId,
          readByUserId: userId
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // =========================================================================
    // EVENT: DELETE MESSAGE (Delete For Everyone)
    // =========================================================================
    socket.on('delete_message', async (data: { messageId: string; conversationId: string }) => {
      try {
        const { messageId, conversationId } = data;
        if (!messageId || !conversationId) return;

        await messageService.deleteMessage(messageId, userId);

        const roomName = `conv_${conversationId}`;
        io.to(roomName).emit('message_deleted', {
          messageId,
          conversationId
        });
      } catch (error: any) {
        socket.emit('error_message', { error: error.message || 'Failed to delete message' });
      }
    });

    // =========================================================================
    // EVENT: CLEAR CHAT
    // =========================================================================
    socket.on('clear_chat', async (conversationId: string) => {
      try {
        if (!conversationId) return;

        await conversationService.clearConversationMessages(conversationId, userId);

        const roomName = `conv_${conversationId}`;
        io.to(roomName).emit('chat_cleared', {
          conversationId
        });
      } catch (error: any) {
        socket.emit('error_message', { error: error.message || 'Failed to clear chat' });
      }
    });

    // =========================================================================
    // EVENT: DELETE CONVERSATION
    // =========================================================================
    socket.on('delete_conversation', async (conversationId: string) => {
      try {
        if (!conversationId) return;

        await conversationService.deleteConversation(conversationId, userId);
        participantCache.delete(conversationId);

        const roomName = `conv_${conversationId}`;
        io.to(roomName).emit('conversation_deleted', {
          conversationId
        });
      } catch (error: any) {
        socket.emit('error_message', { error: error.message || 'Failed to delete conversation' });
      }
    });

    // =========================================================================
    // EVENT: DISCONNECTION & PRESENCE CLEANUP
    // =========================================================================
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          schedulePresenceBroadcast();
        }
      }
    });
  });
};
