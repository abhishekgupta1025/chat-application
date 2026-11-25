import dotenv from 'dotenv';

dotenv.config();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set');
  }
  return secret;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgrespassword@localhost:5432/postgres',
  jwtSecret: requireJwtSecret(),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminSecret: process.env.ADMIN_SECRET?.trim() || '',
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100
} as const;
