const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning transactional data...');
  
  // Delete in order to avoid foreign key constraint errors
  await prisma.transactionItem.deleteMany();
  console.log('Deleted TransactionItems');
  
  await prisma.transaction.deleteMany();
  console.log('Deleted Transactions');
  
  await prisma.expense.deleteMany();
  console.log('Deleted Expenses');
  
  await prisma.shift.deleteMany();
  console.log('Deleted Shifts');

  await prisma.inventoryLog.deleteMany();
  console.log('Deleted Inventory Logs (Product stock count remains intact)');

  console.log('Database cleaned! Only Products and their related types/variants remain.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
