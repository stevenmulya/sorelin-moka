import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Testing SQLite Pragmas...');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;');

  const journalMode = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
  const busyTimeout = await prisma.$queryRawUnsafe('PRAGMA busy_timeout;');
  const foreignKeys = await prisma.$queryRawUnsafe('PRAGMA foreign_keys;');

  console.log('Journal mode:', journalMode);
  console.log('Busy timeout:', busyTimeout);
  console.log('Foreign keys:', foreignKeys);
}

main().catch(console.error).finally(() => prisma.$disconnect());
