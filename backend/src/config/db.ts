import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/postgres';

// Initialize postgres.js client with connection pooling and SSL support for Supabase
export const pgClient = postgres(connectionString, {
  max: 15,
  idle_timeout: 20,
  connect_timeout: 15,
  ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=require') ? 'require' : false
});

export const db = drizzle(pgClient, { schema });

export const connectDB = async (): Promise<void> => {
  try {
    await pgClient`SELECT 1`;
    console.log('✅ Connected to Supabase PostgreSQL database safely via Drizzle ORM!');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
  }
};
