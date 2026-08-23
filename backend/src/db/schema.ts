import { pgTable, uuid, varchar, text, boolean, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// 1. USERS TABLE
// =============================================================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// =============================================================================
// 2. CONVERSATIONS TABLE
// =============================================================================
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    isGroup: boolean('is_group').default(false).notNull(),
    name: varchar('name', { length: 100 }),
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    lastMessageId: uuid('last_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_conversations_updated').on(table.updatedAt)
  ]
);

// =============================================================================
// 3. CONVERSATION PARTICIPANTS (Junction Table for Many-to-Many)
// =============================================================================
export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index('idx_participants_user').on(table.userId),
    index('idx_participants_conversation').on(table.conversationId)
  ]
);

// =============================================================================
// 4. MESSAGES TABLE
// =============================================================================
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    senderName: varchar('sender_name', { length: 50 }).notNull(),
    text: text('text').notNull(),
    status: varchar('status', { length: 20 }).default('sent').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_messages_cursor').on(table.conversationId, table.createdAt)
  ]
);

// =============================================================================
// 5. MESSAGE READS (Junction Table for Read Receipts)
// =============================================================================
export const messageReads = pgTable(
  'message_reads',
  {
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId] }),
    index('idx_message_reads_user').on(table.userId)
  ]
);

// =============================================================================
// 6. DRIZZLE RELATIONS
// =============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
  messageReads: many(messageReads)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  admin: one(users, {
    fields: [conversations.adminId],
    references: [users.id]
  }),
  lastMessage: one(messages, {
    fields: [conversations.lastMessageId],
    references: [messages.id]
  }),
  participants: many(conversationParticipants),
  messages: many(messages)
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id]
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id]
  })
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id]
  }),
  reads: many(messageReads)
}));

export const messageReadsRelations = relations(messageReads, ({ one }) => ({
  message: one(messages, {
    fields: [messageReads.messageId],
    references: [messages.id]
  }),
  user: one(users, {
    fields: [messageReads.userId],
    references: [users.id]
  })
}));

// Export TypeScript Types inferred directly from Schema!
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
