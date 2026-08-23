import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../config/db';
import { messages, messageReads, Message, NewMessage } from '../db/schema';

export class MessageRepository {
  async create(data: NewMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(data).returning();
    return created;
  }

  async findByConversation(
    conversationId: string,
    beforeDate?: Date,
    limit: number = 50
  ): Promise<Message[]> {
    const whereCondition = beforeDate
      ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, beforeDate))
      : eq(messages.conversationId, conversationId);

    const list = await db.query.messages.findMany({
      where: whereCondition,
      orderBy: [desc(messages.createdAt)],
      limit
    });

    return list.reverse();
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const convMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      columns: { id: true }
    });

    if (convMessages.length > 0) {
      const readsToInsert = convMessages.map((m) => ({
        messageId: m.id,
        userId: userId
      }));

      await db.insert(messageReads).values(readsToInsert).onConflictDoNothing();
    }
  }
}

export const messageRepository = new MessageRepository();
