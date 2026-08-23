import { describe, expect, it } from 'bun:test';
import { AuthService } from '../services/authService';
import { ConversationService } from '../services/conversationService';
import { BadRequestError, UnauthorizedError, ConflictError } from '../errors/AppError';

// Mock User Repository for unit testing
const createMockUserRepo = (existingUsers: any[] = []) => ({
  findById: async (id: string) => existingUsers.find((u) => u.id === id),
  findByUsername: async (username: string) => existingUsers.find((u) => u.username === username),
  create: async (data: any) => ({ id: 'mock-uuid-1', ...data, createdAt: new Date(), updatedAt: new Date() }),
  findAllExcept: async (id?: string) => existingUsers.filter((u) => u.id !== id),
  search: async (q: string) => existingUsers.filter((u) => u.username.includes(q)),
  findManyByIds: async (ids: string[]) => existingUsers.filter((u) => ids.includes(u.id))
});

// Mock Conversation Repository for unit testing
const createMockConvRepo = (existingConvs: any[] = []) => ({
  findUserConversations: async (_userId: string) => existingConvs,
  findDirectConversation: async (userA: string, userB: string) =>
    existingConvs.find((c) => !c.isGroup && c.participants?.some((p: any) => p.userId === userA) && c.participants?.some((p: any) => p.userId === userB)) || null,
  create: async (data: any, _pIds: string[]) => ({ id: 'conv-uuid-1', ...data, updatedAt: new Date(), createdAt: new Date() }),
  isParticipant: async () => true,
  updateLastMessage: async () => {}
});

describe('LLD Service Layer Unit Tests (Dependency Injected Mocks)', () => {
  it('AuthService.register should throw BadRequestError on empty credentials', async () => {
    const authService = new AuthService(createMockUserRepo() as any);
    expect(authService.register('', '')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('AuthService.register should throw BadRequestError if password is under 6 characters', async () => {
    const authService = new AuthService(createMockUserRepo() as any);
    expect(authService.register('validuser', '123')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('AuthService.register should throw ConflictError if username already exists', async () => {
    const mockRepo = createMockUserRepo([{ id: '1', username: 'existinguser', password: 'hash' }]);
    const authService = new AuthService(mockRepo as any);
    expect(authService.register('existinguser', 'password123')).rejects.toBeInstanceOf(ConflictError);
  });

  it('AuthService.login should throw UnauthorizedError on invalid username', async () => {
    const mockRepo = createMockUserRepo([]);
    const authService = new AuthService(mockRepo as any);
    expect(authService.login('unknownuser', 'password123')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ConversationService.getOrCreateDirectConversation should prevent self-chat', async () => {
    const convService = new ConversationService(createMockConvRepo() as any, createMockUserRepo() as any);
    expect(convService.getOrCreateDirectConversation('user-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('ConversationService.createGroupConversation should require at least one member', async () => {
    const convService = new ConversationService(createMockConvRepo() as any, createMockUserRepo() as any);
    expect(convService.createGroupConversation('user-1', 'Group Name', [])).rejects.toBeInstanceOf(BadRequestError);
  });
});
