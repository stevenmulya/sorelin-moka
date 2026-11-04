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

async function seedTurso() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error('Missing TURSO credentials in .env');
    process.exit(1);
  }

  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  console.log(`Connected to Turso. Seeding master variants...`);

  // 1. Create or get ProductType 'Saltbread'
  let typeRes = await client.execute({ sql: `SELECT id FROM "ProductType" WHERE name = 'Saltbread'`, args: [] });
  let typeId: number;
  if (typeRes.rows.length > 0) {
    typeId = typeRes.rows[0].id as number;
  } else {
    const ins = await client.execute({ sql: `INSERT INTO "ProductType" (name) VALUES ('Saltbread') RETURNING id`, args: [] });
    typeId = ins.rows[0].id as number;
  }

  // 2. Create or get ProductType 'Bundling'
  let bundleTypeRes = await client.execute({ sql: `SELECT id FROM "ProductType" WHERE name = 'Bundling'`, args: [] });
  let bundleTypeId: number;
  if (bundleTypeRes.rows.length > 0) {
    bundleTypeId = bundleTypeRes.rows[0].id as number;
  } else {
    const ins = await client.execute({ sql: `INSERT INTO "ProductType" (name) VALUES ('Bundling') RETURNING id`, args: [] });
    bundleTypeId = ins.rows[0].id as number;
  }

  // 3. Upsert Korean Saltbread
  const saltName = 'Korean Saltbread (Fresh Baked)';
  let prodRes = await client.execute({ sql: `SELECT id FROM "Product" WHERE name = ?`, args: [saltName] });
  let prodId: number;
  if (prodRes.rows.length > 0) {
    prodId = prodRes.rows[0].id as number;
    await client.execute({
      sql: `UPDATE "Product" SET price = 15000, costPrice = 7000, stock = 70, isActive = 1, typeId = ? WHERE id = ?`,
      args: [typeId, prodId]
    });
  } else {
    const ins = await client.execute({
      sql: `INSERT INTO "Product" (name, price, costPrice, stock, priority, isActive, typeId, updatedAt) VALUES (?, 15000, 7000, 70, 100, 1, ?, CURRENT_TIMESTAMP) RETURNING id`,
      args: [saltName, typeId]
    });
    prodId = ins.rows[0].id as number;
  }

  // 4. Upsert Variant Options for Korean Saltbread
  const variants = [
    { name: 'Original Sea Salt', price: 15000, costPrice: 6500, stock: 25, bundleUpcharge: 0, priority: 5 },
    { name: 'Garlic Butter', price: 18000, costPrice: 8000, stock: 18, bundleUpcharge: 0, priority: 4 },
    { name: 'Double Cheese Melt', price: 20000, costPrice: 9000, stock: 15, bundleUpcharge: 0, priority: 3 },
    { name: 'Dark Chocolate Melt', price: 20000, costPrice: 8500, stock: 12, bundleUpcharge: 0, priority: 2 },
    { name: 'Truffle Ham & Cheese', price: 24000, costPrice: 12500, stock: 10, bundleUpcharge: 3000, priority: 1 },
  ];

  for (const v of variants) {
    const existing = await client.execute({
      sql: `SELECT id FROM "ProductVariantOption" WHERE productId = ? AND name = ?`,
      args: [prodId, v.name]
    });
    if (existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE "ProductVariantOption" SET price = ?, costPrice = ?, stock = ?, bundleUpcharge = ?, priority = ?, isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [v.price, v.costPrice, v.stock, v.bundleUpcharge, v.priority, existing.rows[0].id]
      });
    } else {
      await client.execute({
        sql: `INSERT INTO "ProductVariantOption" (productId, name, price, costPrice, stock, bundleUpcharge, priority, isActive, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        args: [prodId, v.name, v.price, v.costPrice, v.stock, v.bundleUpcharge, v.priority]
      });
    }
  }

  // 5. Upsert Bundles
  const bundles = [
    { name: 'Box of 3 (Bundle Package)', price: 48000, costPrice: 24000, stock: 30, quota: 3, priority: 90 },
    { name: 'Box of 6 Family Pack (Bundle Package)', price: 92000, costPrice: 48000, stock: 20, quota: 6, priority: 85 },
  ];

  for (const b of bundles) {
    const existing = await client.execute({ sql: `SELECT id FROM "Product" WHERE name = ?`, args: [b.name] });
    if (existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE "Product" SET price = ?, costPrice = ?, stock = ?, isBundle = 1, bundleQuota = ?, isActive = 1, typeId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [b.price, b.costPrice, b.stock, b.quota, bundleTypeId, existing.rows[0].id]
      });
    } else {
      await client.execute({
        sql: `INSERT INTO "Product" (name, price, costPrice, stock, isBundle, bundleQuota, priority, isActive, typeId, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
        args: [b.name, b.price, b.costPrice, b.stock, b.quota, b.priority, bundleTypeId]
      });
    }
  }

  console.log('Turso cloud seeded with master variants & bundles successfully!');
}

seedTurso().catch(console.error);
