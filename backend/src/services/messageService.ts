import { messageRepository, MessageRepository } from '../repositories/messageRepository';
import { conversationRepository, ConversationRepository } from '../repositories/conversationRepository';
import { BadRequestError, ForbiddenError } from '../errors/AppError';
import { isValidUuid } from '../config/env';

const MAX_MESSAGE_LENGTH = 4000;

export class MessageService {
  constructor(
    private msgRepo: MessageRepository = messageRepository,
    private convRepo: ConversationRepository = conversationRepository
  ) {}

  async sendMessage(conversationId: string, senderId: string, senderName: string, text: string) {
    if (!isValidUuid(conversationId) || !text || !text.trim()) {
      throw new BadRequestError('Invalid conversation or empty message text');
    }

    const trimmedText = text.trim();
    if (trimmedText.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestError(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
    }

    const payload = {
      conversationId,
      senderId,
      senderName,
      text: trimmedText,
      status: 'sent'
    };

    const saved = typeof this.msgRepo.createAndTouchConversation === 'function'
      ? await this.msgRepo.createAndTouchConversation(payload)
      : await (async () => {
          const created = await this.msgRepo.create(payload);
          await this.convRepo.updateLastMessage(conversationId, created.id);
          return created;
        })();

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
    if (!isValidUuid(conversationId)) throw new BadRequestError('Invalid conversation ID');

    // Check membership
    const isMember = await this.convRepo.isParticipant(conversationId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation');
    }

    let beforeDate: Date | undefined;
    if (before !== undefined && before !== '') {
      beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        throw new BadRequestError('Invalid before timestamp');
      }
    }

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
    if (!isValidUuid(conversationId) || !isValidUuid(userId)) return;
    await this.msgRepo.markAsRead(conversationId, userId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<{ success: boolean; messageId: string; conversationId: string }> {
    if (!isValidUuid(messageId)) throw new BadRequestError('Invalid message ID');

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
