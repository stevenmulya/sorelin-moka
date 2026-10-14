import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function cleanup() {
  const txs = await prisma.transaction.findMany({
    select: { selfieUrl: true }
  });
  const imgs = await prisma.productImage.findMany({
    select: { url: true }
  });

  const validFiles = new Set<string>();
  for (const t of txs) {
    if (t.selfieUrl) {
      validFiles.add(path.basename(t.selfieUrl));
    }
  }
  for (const img of imgs) {
    if (img.url) {
      validFiles.add(path.basename(img.url));
    }
  }

  console.log('Valid referenced files count:', validFiles.size);
  console.log('Valid files:', Array.from(validFiles));

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    for (const file of files) {
      if (!validFiles.has(file)) {
        console.log('Deleting orphaned upload:', file);
        fs.unlinkSync(path.join(uploadsDir, file));
        deletedCount++;
      } else {
        console.log('Keeping valid file:', file);
      }
    }
    console.log(`Cleanup complete! Deleted ${deletedCount} orphaned files.`);
  }
}

cleanup().finally(() => process.exit(0));
