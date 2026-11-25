import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import { conversations, conversationParticipants, messages, Conversation, NewConversation } from '../db/schema';

export class ConversationRepository {
  async findUserConversations(userId: string) {
    const memberships = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, userId),
      with: {
        conversation: {
          with: {
            participants: {
              with: {
                user: {
                  columns: { id: true, username: true }
                }
              }
            },
            lastMessage: true
          }
        }
      }
    });

    return memberships
      .map((m) => m.conversation)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async findDirectConversation(userA: string, userB: string) {
    const userAConvs = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, userA),
      columns: { conversationId: true }
    });

    const conversationIds = userAConvs.map((c) => c.conversationId);
    if (conversationIds.length === 0) return null;

    const match = await db.query.conversationParticipants.findFirst({
      where: and(
        inArray(conversationParticipants.conversationId, conversationIds),
        eq(conversationParticipants.userId, userB)
      ),
      with: {
        conversation: {
          with: {
            participants: {
              with: {
                user: { columns: { id: true, username: true } }
              }
            },
            lastMessage: true
          }
        }
      }
    });

    if (match && !match.conversation.isGroup) {
      return match.conversation;
    }

    return null;
  }

  async create(data: NewConversation, participantIds: string[]): Promise<Conversation> {
    const [createdConv] = await db.insert(conversations).values(data).returning();

    const participantRows = participantIds.map((uId) => ({
      conversationId: createdConv.id,
      userId: uId
    }));

    await db.insert(conversationParticipants).values(participantRows);

    return createdConv;
  }

  async findParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.conversationId, conversationId),
      columns: { userId: true }
    });
    return rows.map((r) => r.userId);
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const membership = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    });

    return !!membership;
  }

  async findById(conversationId: string): Promise<Conversation | undefined> {
    return await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        participants: {
          with: {
            user: { columns: { id: true, username: true } }
          }
        },
        lastMessage: true
      }
    });
  }

  async deleteById(conversationId: string): Promise<boolean> {
    const deleted = await db.delete(conversations).where(eq(conversations.id, conversationId)).returning({ id: conversations.id });
    return deleted.length > 0;
  }

  async clearMessages(conversationId: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        lastMessageId: null,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId));

    await db.delete(messages).where(eq(messages.conversationId, conversationId));
  }

  async updateLastMessage(conversationId: string, messageId: string | null): Promise<void> {
    await db
      .update(conversations)
      .set({
        lastMessageId: messageId,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId));
  }
}

export const conversationRepository = new ConversationRepository();
