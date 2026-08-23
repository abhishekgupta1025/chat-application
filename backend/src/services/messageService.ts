import { messageRepository, MessageRepository } from '../repositories/messageRepository';
import { conversationRepository, ConversationRepository } from '../repositories/conversationRepository';
import { BadRequestError, ForbiddenError } from '../errors/AppError';

export class MessageService {
  constructor(
    private msgRepo: MessageRepository = messageRepository,
    private convRepo: ConversationRepository = conversationRepository
  ) {}

  async sendMessage(conversationId: string, senderId: string, senderName: string, text: string) {
    if (!conversationId || !text || !text.trim()) {
      throw new BadRequestError('Invalid conversation or empty message text');
    }

    // Insert message
    const saved = await this.msgRepo.create({
      conversationId,
      senderId,
      senderName,
      text: text.trim(),
      status: 'sent'
    });

    // Update conversation lastMessageId
    await this.convRepo.updateLastMessage(conversationId, saved.id);

    return {
      _id: saved.id,
      id: saved.id,
      conversationId: saved.conversationId,
      sender: saved.senderId,
      senderName: saved.senderName,
      text: saved.text,
      status: saved.status,
      createdAt: saved.createdAt
    };
  }

  async getConversationMessages(conversationId: string, userId: string, before?: string, limit: number = 50) {
    if (!conversationId) throw new BadRequestError('Conversation ID is required');

    // Check membership
    const isMember = await this.convRepo.isParticipant(conversationId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation');
    }

    const beforeDate = before ? new Date(before) : undefined;
    const rawList = await this.msgRepo.findByConversation(conversationId, beforeDate, limit);

    return rawList.map((m) => ({
      _id: m.id,
      id: m.id,
      conversationId: m.conversationId,
      sender: m.senderId,
      senderName: m.senderName,
      text: m.text,
      status: m.status,
      createdAt: m.createdAt
    }));
  }

  async markAsRead(conversationId: string, userId: string) {
    if (!conversationId || !userId) return;
    await this.msgRepo.markAsRead(conversationId, userId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<{ success: boolean; messageId: string; conversationId: string }> {
    if (!messageId) throw new BadRequestError('Message ID is required');

    const msg = await this.msgRepo.findById(messageId);
    if (!msg) {
      throw new BadRequestError('Message not found');
    }

    if (msg.senderId !== userId) {
      throw new ForbiddenError('You can only delete your own messages');
    }

    const conversationId = msg.conversationId;
    await this.msgRepo.deleteById(messageId);

    // Refresh lastMessage if needed
    const remainingMessages = await this.msgRepo.findByConversation(conversationId, undefined, 1);
    const newLastMessageId = remainingMessages.length > 0 ? remainingMessages[remainingMessages.length - 1].id : null;
    await this.convRepo.updateLastMessage(conversationId, newLastMessageId);

    return {
      success: true,
      messageId,
      conversationId
    };
  }
}

export const messageService = new MessageService();
