import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

async function migrate() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }

  console.log(`Connecting to Turso: ${tursoUrl}`);
  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  const alterStatements = [
    // TransactionItem columns
    `ALTER TABLE "TransactionItem" ADD COLUMN "selectedVariant" TEXT;`,
    `ALTER TABLE "TransactionItem" ADD COLUMN "isBundle" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "TransactionItem" ADD COLUMN "bundleContents" TEXT;`,
    `ALTER TABLE "TransactionItem" ADD COLUMN "notes" TEXT;`,
    // Product columns
    `ALTER TABLE "Product" ADD COLUMN "availableVariants" TEXT;`,
    `ALTER TABLE "Product" ADD COLUMN "isBundle" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Product" ADD COLUMN "bundleQuota" INTEGER;`,
  ];

  for (const sql of alterStatements) {
    try {
      await client.execute(sql);
      console.log(`✓ Executed: ${sql}`);
    } catch (err: any) {
      if (err.message?.includes('duplicate column name')) {
        console.log(`- Column already exists: ${sql}`);
      } else {
        console.warn(`! Note for "${sql}":`, err.message);
      }
    }
  }

  console.log('\nMigration to Turso completed successfully!');
}

migrate().catch(console.error);
