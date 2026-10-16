import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually if not loaded
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

async function syncTurso() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    console.error('\n❌ Error: TURSO_DATABASE_URL environment variable is not set!');
    console.error('Example: TURSO_DATABASE_URL="libsql://your-db-name.turso.io"');
    process.exit(1);
  }
  if (!tursoToken) {
    console.error('\n❌ Error: TURSO_AUTH_TOKEN environment variable is not set!');
    console.error('Generate a token in your Turso dashboard (Database -> Tokens -> Generate Token)');
    console.error('and add it to your .env file or run:');
    console.error('  TURSO_AUTH_TOKEN="<your_token>" npm run db:turso:sync');
    process.exit(1);
  }

  console.log(`\n🚀 Connecting to Turso Cloud: ${tursoUrl}...`);
  const tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS "ProductType" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS "ProductVariant" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS "Product" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "typeId" INTEGER,
      "variantId" INTEGER,
      "description" TEXT,
      "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
      "isFavorite" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "costPrice" INTEGER NOT NULL DEFAULT 0,
      "price" INTEGER NOT NULL,
      "discountPrice" INTEGER,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Product_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ProductType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Product_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "ProductImage" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "url" TEXT NOT NULL,
      "productId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "Shift" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endTime" DATETIME,
      "status" TEXT NOT NULL DEFAULT 'Open',
      "initialCash" INTEGER NOT NULL DEFAULT 0,
      "expectedCash" INTEGER,
      "actualCash" INTEGER,
      "openedBy" TEXT NOT NULL,
      "closedBy" TEXT,
      "activeKey" INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS "Expense" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
      "startDate" DATETIME NOT NULL,
      "endDate" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "shiftId" INTEGER,
      CONSTRAINT "Expense_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "customer" TEXT NOT NULL,
      "customerEmail" TEXT,
      "customerPhone" TEXT,
      "amount" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Waiting Payment',
      "cashierName" TEXT,
      "paidAmount" INTEGER,
      "paymentMethod" TEXT,
      "selfieUrl" TEXT,
      "cancelReason" TEXT,
      "preparedAt" DATETIME,
      "readyAt" DATETIME,
      "pickedUpAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "shiftId" INTEGER,
      CONSTRAINT "Transaction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "TransactionItem" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "transactionId" INTEGER NOT NULL,
      "productId" INTEGER,
      "productName" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "price" INTEGER NOT NULL,
      "costPrice" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "InventoryLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "productId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "giver" TEXT,
      "receiver" TEXT,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_name_key" ON "ProductType"("name");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_name_key" ON "ProductVariant"("name");`,
    `CREATE INDEX IF NOT EXISTS "Product_isActive_priority_idx" ON "Product"("isActive", "priority");`,
    `CREATE INDEX IF NOT EXISTS "InventoryLog_productId_idx" ON "InventoryLog"("productId");`,
    `CREATE INDEX IF NOT EXISTS "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");`,
    `CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Shift_activeKey_key" ON "Shift"("activeKey");`,
    `CREATE INDEX IF NOT EXISTS "Shift_status_idx" ON "Shift"("status");`,
    `CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON "Transaction"("status");`,
    `CREATE INDEX IF NOT EXISTS "Transaction_shiftId_status_idx" ON "Transaction"("shiftId", "status");`,
    `CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");`,
    `CREATE INDEX IF NOT EXISTS "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");`,
    `CREATE INDEX IF NOT EXISTS "TransactionItem_productId_idx" ON "TransactionItem"("productId");`,
    `CREATE INDEX IF NOT EXISTS "Product_typeId_idx" ON "Product"("typeId");`,
    `CREATE INDEX IF NOT EXISTS "Product_variantId_idx" ON "Product"("variantId");`,
    `CREATE INDEX IF NOT EXISTS "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");`,
    `CREATE INDEX IF NOT EXISTS "Expense_shiftId_idx" ON "Expense"("shiftId");`,
    `CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "Expense"("createdAt");`,
  ];

  console.log('📦 Creating tables and indexes on Turso...');
  for (const sql of schemaStatements) {
    await tursoClient.execute(sql);
  }
  console.log('✅ Database schema created successfully!');

  // Copy initial product catalog from local (dev.db) so the cloud database is seeded
  try {
    const localClient = createClient({ url: 'file:prisma/dev.db' });
    const localTypes = await localClient.execute('SELECT * FROM ProductType');
    const localVariants = await localClient.execute('SELECT * FROM ProductVariant');
    const localProducts = await localClient.execute('SELECT * FROM Product');
    const localImages = await localClient.execute('SELECT * FROM ProductImage');

    console.log(`📋 Copying product catalog from local SQLite (${localProducts.rows.length} items)...`);

    for (const t of localTypes.rows) {
      await tursoClient.execute({
        sql: 'INSERT OR IGNORE INTO ProductType (id, name) VALUES (?, ?)',
        args: [t.id, t.name],
      });
    }

    for (const v of localVariants.rows) {
      await tursoClient.execute({
        sql: 'INSERT OR IGNORE INTO ProductVariant (id, name) VALUES (?, ?)',
        args: [v.id, v.name],
      });
    }

    for (const p of localProducts.rows) {
      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO Product (id, name, typeId, variantId, description, isBestSeller, isFavorite, isActive, costPrice, price, discountPrice, stock, priority, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.name,
          p.typeId,
          p.variantId,
          p.description,
          p.isBestSeller,
          p.isFavorite,
          p.isActive,
          p.costPrice,
          p.price,
          p.discountPrice,
          p.stock,
          p.priority,
          p.createdAt,
          p.updatedAt,
        ],
      });
    }

    for (const img of localImages.rows) {
      await tursoClient.execute({
        sql: 'INSERT OR REPLACE INTO ProductImage (id, url, productId, createdAt) VALUES (?, ?, ?, ?)',
        args: [img.id, img.url, img.productId, img.createdAt],
      });
    }

    console.log('✨ Product catalog and variants synced to Turso!');
  } catch (err) {
    console.warn('⚠️ Skipping local catalog copy (using empty tables):', err);
  }

  console.log('\n🎉 Done! Your Turso database is ready for production.');
}

syncTurso().catch((e) => {
  console.error('\n❌ Failed to sync with Turso:', e);
  process.exit(1);
});
