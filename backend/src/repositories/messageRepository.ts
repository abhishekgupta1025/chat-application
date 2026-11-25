import { eq, and, desc, lt } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { messages, messageReads, Message, NewMessage } from '../db/schema';

export class MessageRepository {
  async create(data: NewMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(data).returning();
    return created;
  }

  /**
   * Inserts a message and updates its parent conversation's last_message_id
   * in a single PostgreSQL round-trip via CTE.
   */
  async createAndTouchConversation(data: NewMessage): Promise<Message> {
    const status = data.status ?? 'sent';
    const [row] = await pgClient<Array<{
      id: string;
      conversationId: string;
      senderId: string;
      senderName: string;
      text: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>>`
      WITH inserted AS (
        INSERT INTO messages (conversation_id, sender_id, sender_name, text, status)
        VALUES (${data.conversationId}, ${data.senderId}, ${data.senderName}, ${data.text}, ${status})
        RETURNING
          id,
          conversation_id AS "conversationId",
          sender_id AS "senderId",
          sender_name AS "senderName",
          text,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      ),
      updated_conv AS (
        UPDATE conversations
        SET last_message_id = (SELECT id FROM inserted),
            updated_at = NOW()
        WHERE id = ${data.conversationId}
      )
      SELECT * FROM inserted
    `;
    return row;
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

  async findById(messageId: string): Promise<Message | undefined> {
    return await db.query.messages.findFirst({
      where: eq(messages.id, messageId)
    });
  }

  async deleteById(messageId: string): Promise<Message | null> {
    const [deleted] = await db.delete(messages).where(eq(messages.id, messageId)).returning();
    return deleted || null;
  }

  async deleteByConversation(conversationId: string): Promise<number> {
    const deleted = await db.delete(messages).where(eq(messages.conversationId, conversationId)).returning({ id: messages.id });
    return deleted.length;
  }

  async deleteOlderThan(cutoffDate: Date): Promise<number> {
    const deleted = await db.delete(messages).where(lt(messages.createdAt, cutoffDate)).returning({ id: messages.id });
    return deleted.length;
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
