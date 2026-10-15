import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

async function resetAllData() {
  console.log('🧹 Memulai pembersihan seluruh data transaksi & shift...');

  // 1. Hapus transaksi & relasinya
  const deletedItems = await prisma.transactionItem.deleteMany({});
  console.log(`- Terhapus ${deletedItems.count} TransactionItems`);

  const deletedTxs = await prisma.transaction.deleteMany({});
  console.log(`- Terhapus ${deletedTxs.count} Transactions`);

  // 2. Hapus pengeluaran operasional
  const deletedExpenses = await prisma.expense.deleteMany({});
  console.log(`- Terhapus ${deletedExpenses.count} Expenses`);

  // 3. Hapus log inventaris
  const deletedLogs = await prisma.inventoryLog.deleteMany({});
  console.log(`- Terhapus ${deletedLogs.count} InventoryLogs`);

  // 4. Hapus seluruh riwayat shift
  const deletedShifts = await prisma.shift.deleteMany({});
  console.log(`- Terhapus ${deletedShifts.count} Shifts`);

  // 5. Bersihkan foto selfie di folder uploads (tetap pertahankan gambar produk)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let deletedSelfies = 0;
    for (const f of files) {
      if (f.startsWith('selfie_')) {
        try {
          fs.unlinkSync(path.join(uploadsDir, f));
          deletedSelfies++;
        } catch (e) {
          console.error(`Gagal menghapus ${f}:`, e);
        }
      }
    }
    console.log(`- Terhapus ${deletedSelfies} file selfie dari folder uploads/`);
  }

  // 6. Reset stok produk ke stok awal (default 20 tiap item aktif)
  await prisma.product.updateMany({
    data: { stock: 20 },
  });
  console.log('✅ Stok semua produk telah di-reset ke 20.');

  console.log('\n🎉 Database berhasil dibersihkan total dari 0! Siap untuk pengujian awal baru.');
}

resetAllData()
  .catch((e) => {
    console.error('❌ Gagal reset database:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
