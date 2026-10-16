import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/uploads';
import fs from 'fs';
import path from 'path';

async function resetAllData() {
  if (process.env.CONFIRM_RESET !== 'YES') {
    console.error(
      '❌ Safety check failed: Set CONFIRM_RESET=YES to run this destructive reset script.\n' +
        'Example: CONFIRM_RESET=YES npm run db:reset',
    );
    process.exit(1);
  }

  console.log('🧹 Starting full cleanup of transactions, expenses, inventory logs, and shifts...');

  // 1. Delete transactions & related items
  const deletedItems = await prisma.transactionItem.deleteMany({});
  console.log(`- Deleted ${deletedItems.count} TransactionItems`);

  const deletedTxs = await prisma.transaction.deleteMany({});
  console.log(`- Deleted ${deletedTxs.count} Transactions`);

  // 2. Delete operational expenses
  const deletedExpenses = await prisma.expense.deleteMany({});
  console.log(`- Deleted ${deletedExpenses.count} Expenses`);

  // 3. Delete inventory logs
  const deletedLogs = await prisma.inventoryLog.deleteMany({});
  console.log(`- Deleted ${deletedLogs.count} InventoryLogs`);

  // 4. Delete all shift history
  const deletedShifts = await prisma.shift.deleteMany({});
  console.log(`- Deleted ${deletedShifts.count} Shifts`);

  // 5. Clean up selfie photos in uploads directory (keep product images)
  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedSelfies = 0;
    for (const f of files) {
      if (f.startsWith('selfie_')) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, f));
          deletedSelfies++;
        } catch (e) {
          console.error(`Failed to delete ${f}:`, e);
        }
      }
    }
    console.log(`- Deleted ${deletedSelfies} selfie files from uploads/`);
  }

  // 6. Reset product stock to initial default (20 per active item)
  await prisma.product.updateMany({
    data: { stock: 20 },
  });
  console.log('✅ All product stock quantities have been reset to 20.');

  console.log('\n🎉 Database reset complete!');
}

resetAllData()
  .catch((e) => {
    console.error('❌ Database reset failed:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
