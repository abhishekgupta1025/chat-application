import { conversationRepository, ConversationRepository } from '../repositories/conversationRepository';
import { userRepository, UserRepository } from '../repositories/userRepository';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { isValidUuid } from '../config/env';

export class ConversationService {
  constructor(
    private convRepo: ConversationRepository = conversationRepository,
    private userRepo: UserRepository = userRepository
  ) {}

  async getUserConversations(userId?: string) {
    if (!userId) throw new UnauthorizedError('User authentication required');

    const list = await this.convRepo.findUserConversations(userId);

    return list.map((c: any) => ({
      _id: c.id,
      id: c.id,
      isGroup: c.isGroup,
      name: c.name,
      adminId: c.adminId,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      participants: (c.participants || []).map((p: any) => ({
        _id: p.user?.id || p.userId,
        id: p.user?.id || p.userId,
        username: p.user?.username || ''
      })),
      lastMessage: c.lastMessage
        ? {
            _id: c.lastMessage.id,
            id: c.lastMessage.id,
            text: c.lastMessage.text,
            sender: c.lastMessage.senderId,
            senderName: c.lastMessage.senderName,
            status: c.lastMessage.status,
            createdAt: c.lastMessage.createdAt
          }
        : null
    }));
  }

  async getOrCreateDirectConversation(currentUserId: string, recipientId: string) {
    if (!recipientId) throw new BadRequestError('Recipient ID is required');
    if (!isValidUuid(recipientId)) {
      throw new BadRequestError('Invalid recipient ID format');
    }
    if (currentUserId === recipientId) {
      throw new BadRequestError('Cannot create a direct conversation with yourself');
    }

    const existing = await this.convRepo.findDirectConversation(currentUserId, recipientId);
    if (existing) {
      return {
        _id: existing.id,
        id: existing.id,
        isGroup: existing.isGroup,
        name: existing.name,
        updatedAt: existing.updatedAt,
        participants: ((existing as any).participants || []).map((p: any) => ({
          _id: p.user?.id || p.userId,
          id: p.user?.id || p.userId,
          username: p.user?.username || ''
        })),
        lastMessage: existing.lastMessage
      };
    }

    const created = await this.convRepo.create(
      { isGroup: false },
      [currentUserId, recipientId]
    );

    const participantUsers = await this.userRepo.findManyByIds([currentUserId, recipientId]);

    return {
      _id: created.id,
      id: created.id,
      isGroup: false,
      name: null,
      updatedAt: created.updatedAt,
      participants: participantUsers.map((u) => ({
        _id: u.id,
        id: u.id,
        username: u.username
      })),
      lastMessage: null
    };
  }

  async createGroupConversation(currentUserId: string, name: string, participantIds: string[]) {
    if (!name || !name.trim()) throw new BadRequestError('Group name is required');
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      throw new BadRequestError('At least one participant is required to create a group');
    }
    if (!participantIds.every(isValidUuid)) {
      throw new BadRequestError('Invalid participant ID format');
    }

    const uniqueIds = Array.from(new Set([...participantIds, currentUserId]));

    const created = await this.convRepo.create(
      {
        isGroup: true,
        name: name.trim(),
        adminId: currentUserId
      },
      uniqueIds
    );

    const participantUsers = await this.userRepo.findManyByIds(uniqueIds);

    return {
      _id: created.id,
      id: created.id,
      isGroup: true,
      name: created.name,
      adminId: created.adminId,
      updatedAt: created.updatedAt,
      participants: participantUsers.map((u) => ({
        _id: u.id,
        id: u.id,
        username: u.username
      })),
      lastMessage: null
    };
  }

  async clearConversationMessages(conversationId: string, userId: string): Promise<{ success: boolean; conversationId: string }> {
    if (!isValidUuid(conversationId)) throw new BadRequestError('Invalid conversation ID');

    const isMember = await this.convRepo.isParticipant(conversationId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation');
    }

    await this.convRepo.clearMessages(conversationId);

    return {
      success: true,
      conversationId
    };
  }

  async deleteConversation(conversationId: string, userId: string): Promise<{ success: boolean; conversationId: string }> {
    if (!isValidUuid(conversationId)) throw new BadRequestError('Invalid conversation ID');

    const isMember = await this.convRepo.isParticipant(conversationId, userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation');
    }

    const conv = await this.convRepo.findById(conversationId);
    if (!conv) {
      throw new BadRequestError('Conversation not found');
    }

    // If group with admin, only admin can delete
    if (conv.isGroup && conv.adminId && conv.adminId !== userId) {
      throw new ForbiddenError('Only group admins can delete group channels');
    }

    await this.convRepo.deleteById(conversationId);

    return {
      success: true,
      conversationId
    };
  }
}

export const conversationService = new ConversationService();
