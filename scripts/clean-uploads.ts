import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/uploads';
import fs from 'fs';
import path from 'path';

async function cleanup() {
  const [txs, imgs] = await Promise.all([
    prisma.transaction.findMany({
      select: { selfieUrl: true },
    }),
    prisma.productImage.findMany({
      select: { url: true },
    }),
  ]);

  const validFiles = new Set<string>();
  for (const t of txs) {
    if (t.selfieUrl && !t.selfieUrl.startsWith('data:')) {
      validFiles.add(path.basename(t.selfieUrl));
    }
  }
  for (const img of imgs) {
    if (img.url && !img.url.startsWith('data:')) {
      validFiles.add(path.basename(img.url));
    }
  }

  console.log('Valid referenced files count:', validFiles.size);

  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedCount = 0;
    for (const file of files) {
      if (!validFiles.has(file)) {
        console.log('Deleting orphaned upload:', file);
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
        deletedCount++;
      } else {
        console.log('Keeping valid file:', file);
      }
    }
    console.log(`Cleanup complete! Deleted ${deletedCount} orphaned files.`);
  }
}

cleanup().finally(() => process.exit(0));
