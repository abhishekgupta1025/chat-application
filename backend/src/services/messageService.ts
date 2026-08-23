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
}

export const messageService = new MessageService();
