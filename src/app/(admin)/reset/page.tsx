import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import SystemResetView from '@/components/SystemResetView';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function SystemResetPage() {
  await connection();

  const [transactions, shifts, products, variants, expenses, inventoryLogs] = await Promise.all([
    prisma.transaction.count(),
    prisma.shift.count(),
    prisma.product.count(),
    prisma.productVariantOption.count(),
    prisma.expense.count(),
    prisma.inventoryLog.count(),
  ]);

  return (
    <SystemResetView
      counts={{
        transactions,
        shifts,
        products,
        variants,
        expenses,
        inventoryLogs,
      }}
    />
  );
}
