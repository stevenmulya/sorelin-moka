import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // 1. On Vercel (Serverless): Automatically use Turso Cloud Database
  // 2. On Local Machine: Use ultra-fast Local SQLite by default (0ms latency, no 17s lag),
  //    or Turso Cloud if explicitly testing via USE_TURSO=true
  const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
  const useTurso = isVercel || process.env.USE_TURSO === 'true';
  const tursoUrl = useTurso ? process.env.TURSO_DATABASE_URL : undefined;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  // Use Turso LibSQL adapter on Vercel or when USE_TURSO=true
  if (tursoUrl) {
    // https:// uses HTTP/2 with persistent keep-alive and connection pooling,
    // which is 3x faster than cold WebSocket handshakes on libsql://
    const normalizedUrl = tursoUrl.startsWith('libsql://')
      ? tursoUrl.replace('libsql://', 'https://')
      : tursoUrl;

    const libsql = createClient({
      url: normalizedUrl,
      authToken: tursoAuthToken,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  // Standard Local SQLite (bulletproof, zero-network-delay, offline-safe)
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Apply enterprise SQLite production pragmas:
  // 1. WAL Mode: Concurrent reads while writing without mutual blocking
  // 2. Busy Timeout: 5000ms wait queue instead of throwing "database is locked"
  // 3. Synchronous NORMAL: Crash-safe in WAL with maximum write throughput
  // 4. Foreign Keys: Strict relational integrity enforced by the engine
  // 5. Cache Size: 64MB RAM page cache for instant queries
  client.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
  client.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
  client.$queryRawUnsafe('PRAGMA synchronous = NORMAL;').catch(() => {});
  client.$queryRawUnsafe('PRAGMA foreign_keys = ON;').catch(() => {});
  client.$queryRawUnsafe('PRAGMA cache_size = -64000;').catch(() => {});

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

