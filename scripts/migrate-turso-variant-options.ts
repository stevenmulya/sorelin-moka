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

  const statements = [
    `CREATE TABLE IF NOT EXISTS "ProductVariantOption" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "productId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "price" INTEGER NOT NULL,
      "costPrice" INTEGER NOT NULL DEFAULT 0,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "bundleUpcharge" INTEGER NOT NULL DEFAULT 0,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ProductVariantOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "ProductVariantOption_productId_isActive_idx" ON "ProductVariantOption"("productId", "isActive");`,
    `ALTER TABLE "TransactionItem" ADD COLUMN "variantOptionId" INTEGER;`,
    `CREATE INDEX IF NOT EXISTS "TransactionItem_variantOptionId_idx" ON "TransactionItem"("variantOptionId");`,
  ];

  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log(`✓ Executed: ${sql.slice(0, 50)}...`);
    } catch (err: any) {
      if (err.message?.includes('duplicate column name')) {
        console.log(`- Column already exists`);
      } else {
        console.warn(`! Note:`, err.message);
      }
    }
  }

  console.log('\nTurso ProductVariantOption migration complete!');
}

migrate().catch(console.error);
