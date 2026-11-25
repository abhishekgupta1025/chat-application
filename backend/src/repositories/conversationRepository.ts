import { eq, and, inArray } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { conversations, conversationParticipants, messages, Conversation, NewConversation } from '../db/schema';

export class ConversationRepository {
  async countUnreadByConversation(userId: string): Promise<Map<string, number>> {
    const rows = await pgClient<Array<{ conversationId: string; unreadCount: number }>>`
      SELECT m.conversation_id AS "conversationId", COUNT(*)::int AS "unreadCount"
      FROM messages m
      INNER JOIN conversation_participants cp
        ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
      WHERE m.sender_id <> ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM message_reads mr
          WHERE mr.message_id = m.id AND mr.user_id = ${userId}
        )
      GROUP BY m.conversation_id
    `;
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.conversationId, Number(r.unreadCount) || 0);
    }
    return map;
  }
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
    const directUserAConvs = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(and(eq(conversationParticipants.userId, userA), eq(conversations.isGroup, false)));

    const conversationIds = directUserAConvs.map((c) => c.conversationId);
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
    return await db.transaction(async (tx) => {
      const [createdConv] = await tx.insert(conversations).values(data).returning();

      const participantRows = participantIds.map((uId) => ({
        conversationId: createdConv.id,
        userId: uId
      }));

      await tx.insert(conversationParticipants).values(participantRows);

      return createdConv;
    });
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
    await db.transaction(async (tx) => {
      await tx
        .update(conversations)
        .set({
          lastMessageId: null,
          updatedAt: new Date()
        })
        .where(eq(conversations.id, conversationId));

      await tx.delete(messages).where(eq(messages.conversationId, conversationId));
    });
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
