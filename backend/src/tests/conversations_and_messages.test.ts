import { describe, expect, it } from 'bun:test';
import { users, conversations, conversationParticipants, messages, messageReads } from '../db/schema';

describe('PostgreSQL Relational Schema Definition Tests', () => {
  it('should define users table structure correctly', () => {
    expect(users.id).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.password).toBeDefined();
    expect(users.createdAt).toBeDefined();
  });

  it('should define conversations table with group chat and admin support', () => {
    expect(conversations.id).toBeDefined();
    expect(conversations.isGroup).toBeDefined();
    expect(conversations.name).toBeDefined();
    expect(conversations.adminId).toBeDefined();
    expect(conversations.lastMessageId).toBeDefined();
  });

  it('should define junction tables for participants and message reads', () => {
    expect(conversationParticipants.conversationId).toBeDefined();
    expect(conversationParticipants.userId).toBeDefined();
    expect(messageReads.messageId).toBeDefined();
    expect(messageReads.userId).toBeDefined();
  });

  it('should define messages table with foreign key references and status', () => {
    expect(messages.id).toBeDefined();
    expect(messages.conversationId).toBeDefined();
    expect(messages.senderId).toBeDefined();
    expect(messages.senderName).toBeDefined();
    expect(messages.text).toBeDefined();
    expect(messages.status).toBeDefined();
  });
});
