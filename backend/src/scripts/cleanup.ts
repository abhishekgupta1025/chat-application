// backend/src/scripts/cleanup.ts
import { userRepository } from '../repositories/userRepository';
import { messageRepository } from '../repositories/messageRepository';
import { db } from '../config/db';
import { conversations, messages, users } from '../db/schema';
import { sql } from 'drizzle-orm';

/**
 * Master Database Storage Optimization & Purge Utility
 * 
 * Usage:
 *   bun run src/scripts/cleanup.ts               (cleans test users & orphaned data)
 *   bun run src/scripts/cleanup.ts --days 30     (also deletes messages older than 30 days)
 *   bun run src/scripts/cleanup.ts --all         (resets all chat messages and non-admin data)
 */
export async function runDatabaseCleanup(options: { days?: number; resetAll?: boolean } = {}) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧹 DATABASE STORAGE CLEANUP & RETENTION OPTIMIZER');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let deletedUsersCount = 0;
  let deletedMessagesCount = 0;
  let deletedConversationsCount = 0;

  try {
    if (options.resetAll) {
      console.log('⚠️ FULL RESET REQUESTED: Purging all messages, conversations, and test users...');
      const deletedMsgs = await db.delete(messages).returning({ id: messages.id });
      const deletedConvs = await db.delete(conversations).returning({ id: conversations.id });
      deletedUsersCount = await userRepository.deleteTestUsers();
      deletedMessagesCount = deletedMsgs.length;
      deletedConversationsCount = deletedConvs.length;
    } else {
      // 1. Purge automated test user accounts (and cascade their data)
      console.log('🔍 1. Scanning and purging automated test users (alpha_*, live_*, test_*, chk_*)...');
      deletedUsersCount = await userRepository.deleteTestUsers();
      console.log(`   ✅ Purged ${deletedUsersCount} automated test user accounts.`);

      // 2. Retention Policy: Purge messages older than N days if specified
      if (options.days && options.days > 0) {
        const cutoffDate = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
        console.log(`🔍 2. Applying ${options.days}-day retention policy (Cutoff: ${cutoffDate.toISOString()})...`);
        deletedMessagesCount = await messageRepository.deleteOlderThan(cutoffDate);
        console.log(`   ✅ Purged ${deletedMessagesCount} expired messages.`);
      }

      // 3. Remove orphaned conversations (conversations with 0 participants)
      console.log('🔍 3. Cleaning orphaned conversations with no active participants...');
      const orphaned = await db.execute(sql`
        DELETE FROM conversations 
        WHERE id NOT IN (SELECT DISTINCT conversation_id FROM conversation_participants)
        RETURNING id
      `);
      deletedConversationsCount = orphaned.length || 0;
      console.log(`   ✅ Cleaned ${deletedConversationsCount} empty/orphaned conversations.`);
    }

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('📊 CLEANUP SUMMARY:');
    console.log(`   • Test Accounts Deleted:       ${deletedUsersCount}`);
    console.log(`   • Expired Messages Purged:     ${deletedMessagesCount}`);
    console.log(`   • Empty Conversations Cleaned: ${deletedConversationsCount}`);
    console.log('───────────────────────────────────────────────────────────────────\n');
    console.log('✨ Supabase PostgreSQL database storage is now optimized and lean!');

    return {
      success: true,
      deletedUsersCount,
      deletedMessagesCount,
      deletedConversationsCount
    };
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  }
}

// Execute directly if run via CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const resetAll = args.includes('--all');
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 && args[daysIndex + 1] ? parseInt(args[daysIndex + 1], 10) : undefined;

  runDatabaseCleanup({ days, resetAll })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
