import { Server as SocketIOServer, Socket } from 'socket.io';
import { messageService } from '../services/messageService';
import { AuthenticatedSocket } from '../middleware/socketAuth';

// In-Memory state for live presence tracking (can be backed by Redis at scale)
// Maps userId -> Set of active socket IDs (allows multiple browser tabs)
const onlineUsers = new Map<string, Set<string>>();

export const setupSocketServer = (io: SocketIOServer): void => {
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.data.user;

    if (!user) {
      console.warn(`⚠️ Unauthenticated socket connected: ${socket.id}`);
      socket.disconnect();
      return;
    }

    const { userId, username } = user;
    console.log(`🔌 User connected: ${username} (${userId}) on socket ${socket.id}`);

    // Track active socket connection
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set<string>());
    }
    onlineUsers.get(userId)?.add(socket.id);

    // Broadcast updated online users list to all connected clients
    const activeUserIds = Array.from(onlineUsers.keys());
    io.emit('online_users', activeUserIds);

    // =========================================================================
    // EVENT: JOIN CONVERSATION
    // =========================================================================
    socket.on('join_conversation', async (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;

      const roomName = `conv_${conversationId}`;
      socket.join(roomName);
      console.log(`📡 Socket ${socket.id} (${username}) joined room ${roomName}`);
    });

    // =========================================================================
    // EVENT: LEAVE CONVERSATION
    // =========================================================================
    socket.on('leave_conversation', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') return;
      const roomName = `conv_${conversationId}`;
      socket.leave(roomName);
      console.log(`🚪 Socket ${socket.id} (${username}) left room ${roomName}`);
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

          // Leverage domain MessageService to persist and update conversation
          const formattedMessage = await messageService.sendMessage(
            conversationId,
            userId,
            username,
            text
          );

          const roomName = `conv_${conversationId}`;

          // Broadcast to everyone in the room
          io.to(roomName).emit('receive_message', {
            message: formattedMessage,
            tempId
          });

          // Notify all clients to re-order recent conversation previews in sidebar
          io.emit('conversation_updated', {
            conversationId,
            lastMessage: formattedMessage
          });
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
    // EVENT: DISCONNECTION & PRESENCE CLEANUP
    // =========================================================================
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${username})`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('online_users', Array.from(onlineUsers.keys()));
        }
      }
    });
  });
};
